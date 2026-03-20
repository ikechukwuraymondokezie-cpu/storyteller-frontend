import sys
import os
import logging
import warnings
import re

# -------------------- 1. Suppress logs --------------------
os.environ['GLOG_minloglevel'] = '3'
logging.disable(logging.CRITICAL)
warnings.filterwarnings("ignore")

# -------------------- 2. Import PaddleOCR --------------------
try:
    from paddleocr import PaddleOCR
except ImportError:
    sys.exit(1)

# -------------------- 3. Initialize OCR --------------------
ocr = PaddleOCR(
    use_angle_cls=False,   # disabled to save RAM
    lang='en',
    show_log=False,
    use_gpu=False
)

# -------------------- Helpers --------------------

def is_header_text(text):
    """Returns True if text looks like a standalone header."""
    t = text.strip()
    if not t:
        return False
    # ALL CAPS letters only, no digits
    if t == t.upper() and any(c.isalpha() for c in t) and not any(c.isdigit() for c in t):
        return True
    # Keyword headers
    import re
    if re.match(r'^(Chapter|Section|Part|Lesson|Psalm|Act|Scene|Preface|Foreword|'
                r'Introduction|Epilogue|Appendix|Prologue|Conclusion|Afterword|'
                r'Unit|Module|Volume|Book|Verse)\s*(\d+|[IVXLCDM]+)?$', t, re.IGNORECASE):
        return True
    return False


def is_border_wrap(block, page_right, page_width):
    """
    Returns True if a block likely wraps at the page border.
    A border wrap:
    - Has its right edge close to the page right margin (within 12%)
    - Does NOT end with sentence-ending punctuation
    - Is NOT a header
    """
    text = block["text"].strip()
    if not text:
        return False
    # Ends a sentence — not a wrap
    if text[-1] in '.!?':
        return False
    # Headers are intentionally short — not a wrap
    if is_header_text(text):
        return False
    # Check if block's right edge reached the page border
    distance_from_right = page_right - block.get("x_end", block["x"])
    return distance_from_right < page_width * 0.12


# -------------------- Detect column layout --------------------

def split_columns(blocks):
    if not blocks:
        return [blocks]

    xs = [b["x"] for b in blocks]
    mid = sorted(xs)[len(xs) // 2]  # median x as midpoint

    left, right = [], []
    for b in blocks:
        if b["x"] < mid:
            left.append(b)
        else:
            right.append(b)

    # Require at least 40% of blocks on each side to call it two columns
    if len(right) < len(blocks) * 0.4 or len(left) < len(blocks) * 0.4:
        return [blocks]

    return [left, right]

# -------------------- Process blocks into paragraphs --------------------

def blocks_to_text(blocks, line_threshold, paragraph_threshold, page_right, page_width):
    if not blocks:
        return ""

    # Sort strictly top → bottom, then left → right
    blocks.sort(key=lambda b: (b["y"], b["x"]))

    # ---- Build lines ----
    lines = []
    current_words = []
    current_y = None
    current_line_blocks = []

    for block in blocks:
        if current_y is None:
            current_y = block["y"]

        if abs(block["y"] - current_y) > line_threshold:
            lines.append({
                "y": current_y,
                "text": " ".join(current_words),
                "blocks": current_line_blocks
            })
            current_words = [block["text"]]
            current_y = block["y"]
            current_line_blocks = [block]
        else:
            current_words.append(block["text"])
            current_line_blocks.append(block)

    if current_words:
        lines.append({
            "y": current_y,
            "text": " ".join(current_words),
            "blocks": current_line_blocks
        })

    # ---- Build paragraphs using border wrap detection ----
    paragraphs = []
    current_para = ""
    last_y = None

    for line in lines:
        line_text = line["text"].strip()
        if not line_text:
            continue

        # Determine if this line wraps at the border
        # Use the rightmost block in the line for x_end
        line_blocks = line.get("blocks", [])
        rightmost = max(line_blocks, key=lambda b: b.get("x_end", b["x"])) if line_blocks else None
        wraps_at_border = (
            rightmost is not None and
            is_border_wrap(rightmost, page_right, page_width)
        )

        if last_y is not None and abs(line["y"] - last_y) > paragraph_threshold:
            # Large vertical gap = new paragraph
            if current_para:
                paragraphs.append(current_para.strip())
            current_para = line_text + (" " if wraps_at_border else "")
        else:
            if wraps_at_border:
                # Line reaches the border without ending a sentence = join with next
                current_para += line_text + " "
            else:
                # Line ends before the border = natural end, keep separate
                current_para += line_text + " "

        last_y = line["y"]

    if current_para:
        paragraphs.append(current_para.strip())

    # Join lines that were marked as border wraps into single paragraphs
    # The border wrap flag was already used above during building —
    # now collapse any remaining single-newline joins
    return "\n\n".join(p for p in paragraphs if p)


# -------------------- OCR Processing Function --------------------

def process_image(
    image_path,
    line_threshold=15,
    paragraph_threshold=30,
    preserve_sentences=True,
    confidence_threshold=0.7
):
    if not os.path.exists(image_path):
        return ""

    result = ocr.ocr(image_path, cls=False)

    if not result or not result[0]:
        return ""

    # ---- Extract OCR blocks with confidence filtering ----
    page_blocks = []

    for line in result[0]:
        box = line[0]
        text = line[1][0].strip()
        confidence = line[1][1]

        if confidence < confidence_threshold:
            continue

        # box = [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] top-left clockwise
        x_start = box[0][0]
        x_end = box[1][0]
        y = box[0][1]

        page_blocks.append({
            "text": text,
            "x": x_start,
            "x_end": x_end,
            "y": y
        })

    # Free raw OCR result immediately to save RAM
    del result

    if not page_blocks:
        return ""

    # ---- Calculate page dimensions from block positions ----
    page_left = min(b["x"] for b in page_blocks)
    page_right = max(b["x_end"] for b in page_blocks)
    page_width = page_right - page_left

    # ---- Fix hyphenated words at block level ----
    for block in page_blocks:
        block["text"] = block["text"].replace("-\n", "")

    # ---- Detect columns ----
    columns = split_columns(page_blocks)

    # ---- Process columns with border wrap detection ----
    column_texts = [
        blocks_to_text(col, line_threshold, paragraph_threshold, page_right, page_width)
        for col in columns
    ]
    combined_text = "\n\n".join(t for t in column_texts if t)

    # ---- Sentence cleanup ----
    if preserve_sentences:
        paragraphs = combined_text.split("\n\n")
        processed_paragraphs = []

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            sentences = re.split(r'(?<=[.!?]) +', para)
            processed_paragraphs.append(
                " ".join(s.strip() for s in sentences if s.strip()))

        final_text = "\n\n".join(processed_paragraphs)
    else:
        final_text = combined_text

    # ---- Cleanup spacing ----
    final_text = final_text.replace("\n \n", "\n\n")
    lines = final_text.split("\n")
    lines = [" ".join(l.split()) for l in lines]
    final_text = "\n".join(lines)

    return final_text.strip()


# -------------------- CLI Interface --------------------
if __name__ == "__main__":
    if len(sys.argv) > 1:
        output = process_image(sys.argv[1])
        sys.stdout.write(output)
        sys.stdout.flush()