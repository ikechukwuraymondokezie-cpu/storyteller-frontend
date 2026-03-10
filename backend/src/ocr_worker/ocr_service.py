import sys
import os
import logging
import warnings

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

# -------------------- 4. OCR Processing Function --------------------
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

    # -------------------- Extract OCR blocks --------------------
    page_blocks = []

    for line in result[0]:

        box = line[0]
        text = line[1][0].strip()

        x = box[0][0]
        y = box[0][1]

        page_blocks.append({
            "text": text,
            "x": x,
            "y": y
        })

    # -------------------- Sort blocks --------------------
    page_blocks.sort(
        key=lambda b: (
            round(b["y"] / line_threshold),
            b["x"]
        )
    )

    # -------------------- Build Lines --------------------
    lines = []

    current_words = []
    current_y = None

    for block in page_blocks:

        if current_y is None:
            current_y = block["y"]

        # New line detection
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

    # -------------------- Build Paragraphs --------------------
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

    # -------------------- Sentence Preservation --------------------
    final_text = ""

    for para in paragraphs:

        if preserve_sentences:

            sentences = para.split(". ")
            temp = ""

            for s in sentences:

                s = s.strip()

                if not s:
                    continue

                temp += s

                if s[-1] in ".!?":
                    temp += "\n\n"
                else:
                    temp += " "

            final_text += temp.strip() + "\n\n"

        else:

            final_text += para.strip() + "\n\n"

    # -------------------- Cleanup --------------------
    final_text = final_text.replace("\n \n", "\n\n")

    # normalize spaces without breaking paragraphs
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