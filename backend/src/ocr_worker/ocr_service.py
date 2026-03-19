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


def blocks_to_text(blocks, line_threshold, paragraph_threshold, page_center, page_width):
    if not blocks:
        return ""

    # Sort strictly top → bottom, then left → right
    blocks.sort(key=lambda b: (b["y"], b["x"]))

    # ---- Build lines ----
    lines = []
    current_words = []
    current_y = None
    current_centered = False

    for block in blocks:
        if current_y is None:
            current_y = block["y"]

        if abs(block["y"] - current_y) > line_threshold:
            lines.append({
                "y": current_y,
                "text": " ".join(current_words),
                "centered": current_centered
            })
            current_words = [block["text"]]
            current_y = block["y"]
            current_centered = block.get("centered", False)
        else:
            current_words.append(block["text"])
            # If any word in this line is centered, mark the whole line
            if block.get("centered", False):
                current_centered = True

    if current_words:
        lines.append({
            "y": current_y,
            "text": " ".join(current_words),
            "centered": current_centered
        })

    # ---- Build paragraphs ----
    paragraphs = []
    current_para = ""
    current_para_centered = False
    last_y = None

    for line in lines:
        if last_y is not None and abs(line["y"] - last_y) > paragraph_threshold:
            para_text = current_para.strip()
            if para_text:
                if current_para_centered:
                    para_text = f"[CENTERED]{para_text}"
                paragraphs.append(para_text)
            current_para = line["text"] + " "
            current_para_centered = line["centered"]
        else:
            current_para += line["text"] + " "
            if line["centered"]:
                current_para_centered = True
        last_y = line["y"]

    if current_para:
        para_text = current_para.strip()
        if para_text:
            if current_para_centered:
                para_text = f"[CENTERED]{para_text}"
            paragraphs.append(para_text)

    return "\n\n".join(paragraphs)

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

    # ---- Extract OCR blocks (with confidence filtering) ----
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
            "y": y,
            "centered": False  # populated after page width is known
        })

    # Free raw OCR result immediately to save RAM
    del result

    if not page_blocks:
        return ""

    # ---- Detect page dimensions from block positions ----
    page_left = min(b["x"] for b in page_blocks)
    page_right = max(b["x_end"] for b in page_blocks)
    page_width = page_right - page_left
    page_center = page_left + page_width / 2

    # ---- Tag centered blocks ----
    # A block is centered if:
    # 1. Its own center is within 15% of page width from the page center
    # 2. It is not full-width (full-width = body text, not a header)
    tolerance = page_width * 0.15
    for block in page_blocks:
        block_width = block["x_end"] - block["x"]
        block_center = block["x"] + block_width / 2
        is_narrow = block_width < page_width * 0.7
        is_centered = abs(block_center - page_center) < tolerance
        block["centered"] = is_narrow and is_centered

    # ---- Fix hyphenated words at block level ----
    for block in page_blocks:
        block["text"] = block["text"].replace("-\n", "")

    # ---- Detect columns ----
    columns = split_columns(page_blocks)

    # ---- Process columns ----
    column_texts = [
        blocks_to_text(col, line_threshold, paragraph_threshold,
                       page_center, page_width)
        for col in columns
    ]
    combined_text = "\n\n".join(column_texts)

    # ---- Sentence cleanup ----
    if preserve_sentences:
        paragraphs = combined_text.split("\n\n")
        processed_paragraphs = []

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # Preserve [CENTERED] tag through sentence processing
            is_centered = para.startswith("[CENTERED]")
            clean_para = para[len("[CENTERED]"):] if is_centered else para

            sentences = re.split(r'(?<=[.!?]) +', clean_para)
            joined = " ".join(s.strip() for s in sentences if s.strip())

            if is_centered:
                joined = f"[CENTERED]{joined}"

            processed_paragraphs.append(joined)

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
        final_text = process_image(sys.argv[1])
        sys.stdout.write(final_text)
        sys.stdout.flush()
