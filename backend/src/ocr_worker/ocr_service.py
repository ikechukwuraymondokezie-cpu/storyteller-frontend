import sys
import os
import logging
import warnings

# -------------------- 1. Suppress logs --------------------
os.environ['GLOG_minloglevel'] = '3'  # Suppress PaddleOCR logs
logging.disable(logging.CRITICAL)
warnings.filterwarnings("ignore")

# -------------------- 2. Import PaddleOCR --------------------
try:
    from paddleocr import PaddleOCR
except ImportError:
    sys.exit(0)

# -------------------- 3. Initialize OCR --------------------
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False, use_gpu=False)

# -------------------- 4. OCR Processing Function --------------------
def process_image(
    image_path,
    line_threshold=15,
    paragraph_threshold=25,
    preserve_sentences=True
):
    """
    Process an image and return cleaned text with proper paragraph and line reconstruction.

    Args:
        image_path (str): Path to image file.
        line_threshold (int): Y threshold to group words into the same line.
        paragraph_threshold (int): Y distance to start a new paragraph.
        preserve_sentences (bool): Insert paragraph breaks after sentence-ending punctuation.

    Returns:
        str: Cleaned and structured text.
    """
    if not os.path.exists(image_path):
        return ""

    result = ocr.ocr(image_path, cls=True)
    if not result or not result[0]:
        return ""

    # -------------------- Extract word blocks with coordinates --------------------
    page_blocks = []
    for line in result[0]:
        box = line[0]
        text = line[1][0].strip()
        x, y = box[0]  # top-left coordinates
        page_blocks.append({"text": text, "x": x, "y": y})

    # -------------------- Sort words: top-to-bottom, then left-to-right --------------------
    page_blocks.sort(key=lambda b: (round(b['y'] / line_threshold), b['x']))

    # -------------------- Merge words into lines --------------------
    lines = []
    current_line = []
    last_y = -1

    for block in page_blocks:
        if last_y != -1 and abs(block['y'] - last_y) > line_threshold:
            if current_line:
                lines.append(current_line)
            current_line = [block['text']]
        else:
            current_line.append(block['text'])
        last_y = block['y']

    if current_line:
        lines.append(current_line)

    # -------------------- Merge lines into paragraphs --------------------
    paragraphs = []
    current_para = ""
    last_line_y = -1

    for line_words in lines:
        line_text = ' '.join(line_words).strip()
        if not line_text:
            continue

        if last_line_y != -1 and abs(block['y'] - last_line_y) > paragraph_threshold:
            if current_para:
                paragraphs.append(current_para.strip())
            current_para = line_text + " "
        else:
            current_para += line_text + " "
        last_line_y = block['y']

    if current_para:
        paragraphs.append(current_para.strip())

    # -------------------- Optional: Preserve sentence breaks --------------------
    final_text = ""
    for para in paragraphs:
        if preserve_sentences:
            # Add paragraph break after sentence-ending punctuation
            temp = ""
            sentences = para.split('. ')
            for s in sentences:
                s_clean = s.strip()
                if not s_clean:
                    continue
                temp += s_clean
                if s_clean[-1] in ".!?":
                    temp += "\n\n"
                else:
                    temp += " "
            final_text += temp.strip() + "\n\n"
        else:
            final_text += para.strip() + "\n\n"

    # -------------------- Minor cleanup --------------------
    final_text = final_text.replace('\n \n', '\n\n')  # fix empty lines
    final_text = ' '.join(final_text.split())  # normalize spaces

    return final_text.strip()

# -------------------- 5. CLI / Node.js Integration --------------------
if __name__ == "__main__":
    if len(sys.argv) > 1:
        final_text = process_image(sys.argv[1])
        sys.stdout.write(final_text)
        sys.stdout.flush()