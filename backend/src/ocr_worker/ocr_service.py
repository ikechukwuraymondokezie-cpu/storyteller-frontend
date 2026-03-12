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
    sys.exit(0)

# -------------------- 3. Initialize OCR --------------------
ocr = PaddleOCR(
    use_angle_cls=True,
    lang='en',
    show_log=False,
    use_gpu=False
)

# -------------------- Detect column layout --------------------
def split_columns(blocks):
    if not blocks:
        return [blocks]

    xs = [b["x"] for b in blocks]
    min_x = min(xs)
    max_x = max(xs)
    page_width = max_x - min_x
    mid = min_x + page_width / 2

    left, right = [], []

    for b in blocks:
        if b["x"] < mid:
            left.append(b)
        else:
            right.append(b)

    # Adjusted threshold for single column detection
    if len(right) < len(blocks) * 0.3:
        return [blocks]

    return [left, right]

# -------------------- Process blocks into paragraphs --------------------
def blocks_to_text(blocks, line_threshold, paragraph_threshold):
    if not blocks:
        return ""

    # Sort strictly top → bottom, then left → right
    blocks.sort(key=lambda b: (b["y"], b["x"]))

    # ---- Build lines ----
    lines = []
    current_words = []
    current_y = None

    for block in blocks:
        if current_y is None:
            current_y = block["y"]

        if abs(block["y"] - current_y) > line_threshold:
            lines.append({
                "y": current_y,
                "text": " ".join(current_words)
            })
            current_words = [block["text"]]
            current_y = block["y"]
        else:
            current_words.append(block["text"])

    if current_words:
        lines.append({
            "y": current_y,
            "text": " ".join(current_words)
        })

    # ---- Build paragraphs ----
    paragraphs = []
    current_para = ""
    last_y = None

    for line in lines:
        if last_y is not None and abs(line["y"] - last_y) > paragraph_threshold:
            paragraphs.append(current_para.strip())
            current_para = line["text"] + " "
        else:
            current_para += line["text"] + " "
        last_y = line["y"]

    if current_para:
        paragraphs.append(current_para.strip())

    return "\n\n".join(paragraphs)

# -------------------- OCR Processing Function --------------------
def process_image(
    image_path,
    line_threshold=15,
    paragraph_threshold=30,
    preserve_sentences=True
):
    if not os.path.exists(image_path):
        return ""

    result = ocr.ocr(image_path, cls=True)

    if not result or not result[0]:
        return ""

    # ---- Extract OCR blocks ----
    page_blocks = []

    for line in result[0]:
        box = line[0]
        text = line[1][0].strip()
        x, y = box[0][0], box[0][1]

        page_blocks.append({
            "text": text,
            "x": x,
            "y": y
        })

    # ---- Detect columns ----
    columns = split_columns(page_blocks)

    # ---- Process columns ----
    column_texts = [blocks_to_text(col, line_threshold, paragraph_threshold) for col in columns]
    combined_text = "\n\n".join(column_texts)

    # ---- Sentence cleanup ----
    final_text = ""

    if preserve_sentences:
        # Regex-based splitting (safer)
        sentences = re.split(r'(?<=[.!?]) +', combined_text)

        for s in sentences:
            s = s.strip()
            if not s:
                continue

            final_text += s
            if s[-1] in ".!?":
                final_text += "\n\n"
            else:
                final_text += " "
    else:
        final_text = combined_text

    # ---- Fix hyphenated words across lines ----
    final_text = final_text.replace("-\n", "")

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