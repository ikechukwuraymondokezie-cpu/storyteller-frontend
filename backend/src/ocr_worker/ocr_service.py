import sys
import os
import logging
import warnings

# 1. Suppress all Paddle and System logs so Node.js only gets the text
os.environ['GLOG_minloglevel'] = '3'
logging.disable(logging.CRITICAL)
warnings.filterwarnings("ignore")

try:
    from paddleocr import PaddleOCR
except ImportError:
    sys.exit(0)

# Initialize OCR once when the script runs
# use_gpu=False is mandatory for Render Free
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False, use_gpu=False)

def process_image(image_path):
    if not os.path.exists(image_path):
        return ""

    result = ocr.ocr(image_path, cls=True)
    if not result or not result[0]:
        return ""

    # 2. Extract blocks (Your original sorting logic)
    page_blocks = []
    for line in result[0]:
        box = line[0]
        text = line[1][0]
        # box[0] is the top-left corner: [x, y]
        page_blocks.append({"text": text, "x": box[0][0], "y": box[0][1]})

    # 3. Sort: First by Y (divided by threshold for lines), then by X
    # This keeps words on the same horizontal line together
    page_blocks.sort(key=lambda b: (round(b['y'] / 15), b['x']))

    # 4. Join text with smart spacing
    ordered_text = ""
    last_y = -1
    for block in page_blocks:
        if last_y != -1 and (block['y'] - last_y) > 25:
            ordered_text += "\n\n" + block['text']
        else:
            ordered_text += " " + block['text']
        last_y = block['y']

    return ordered_text.strip()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # sys.argv[1] is the image path passed from Node.js
        final_text = process_image(sys.argv[1])
        sys.stdout.write(final_text)
        sys.stdout.flush()