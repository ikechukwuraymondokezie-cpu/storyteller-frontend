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
# use_gpu=False is required for Render Free
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False, use_gpu=False)

# -------------------- 4. OCR Processing Function --------------------
def process_image(image_path, line_threshold=15, paragraph_threshold=25):
    """
    Process an image and return text with smart paragraph and line reconstruction.

    Args:
        image_path (str): Path to the image file.
        line_threshold (int): Vertical threshold to group words on the same line.
        paragraph_threshold (int): Vertical distance to start a new paragraph.

    Returns:
        str: Cleaned and ordered text.
    """
    if not os.path.exists(image_path):
        return ""

    # OCR the image
    result = ocr.ocr(image_path, cls=True)
    if not result or not result[0]:
        return ""

    # Extract text blocks with coordinates
    page_blocks = []
    for line in result[0]:
        box = line[0]
        text = line[1][0]
        x, y = box[0]  # top-left coordinates
        page_blocks.append({"text": text, "x": x, "y": y})

    # Sort: first by Y (line grouping), then by X (left-to-right)
    page_blocks.sort(key=lambda b: (round(b['y'] / line_threshold), b['x']))

    # Merge text intelligently
    ordered_text = ""
    last_y = -1
    buffer_line = ""

    for block in page_blocks:
        # Start new paragraph if the vertical gap is large
        if last_y != -1 and (block['y'] - last_y) > paragraph_threshold:
            if buffer_line:
                ordered_text += buffer_line.strip() + "\n\n"
            buffer_line = block['text'] + " "
        else:
            buffer_line += block['text'] + " "
        last_y = block['y']

    # Add remaining buffer
    if buffer_line:
        ordered_text += buffer_line.strip()

    # Optional minor cleanup: remove extra spaces
    ordered_text = ' '.join(ordered_text.split())

    return ordered_text

# -------------------- 5. CLI / Node.js Integration --------------------
if __name__ == "__main__":
    if len(sys.argv) > 1:
        final_text = process_image(sys.argv[1])
        sys.stdout.write(final_text)
        sys.stdout.flush()