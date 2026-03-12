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

def process_image(image_path, line_threshold=15):
    if not os.path.exists(image_path):
        return ""

    result = ocr.ocr(image_path, cls=True)

    if not result or not result[0]:
        return ""

    # -------------------- Extract Blocks & Find Width --------------------
    page_blocks = []
    max_x = 0
    
    for line in result[0]:
        box = line[0]
        text = line[1][0].strip()
        
        # Get coordinates for the center of the block
        x_start = box[0][0]
        x_end = box[1][0]
        y_top = box[0][1]
        x_center = (x_start + x_end) / 2
        
        if x_end > max_x: max_x = x_end

        page_blocks.append({
            "text": text,
            "x": x_start,
            "x_center": x_center,
            "y": y_top
        })

    # -------------------- Multi-Column Logic --------------------
    # We find the midpoint to split left/right columns
    mid_point = max_x / 2
    left_col_blocks = []
    right_col_blocks = []

    for block in page_blocks:
        if block["x_center"] < mid_point:
            left_col_blocks.append(block)
        else:
            right_col_blocks.append(block)

    # Sort each column individually: Top to Bottom
    left_col_blocks.sort(key=lambda b: (round(b["y"] / line_threshold), b["x"]))
    right_col_blocks.sort(key=lambda b: (round(b["y"] / line_threshold), b["x"]))

    # -------------------- Helper to build lines within a column --------------------
    def build_column_text(blocks):
        if not blocks:
            return ""
        
        lines = []
        current_words = [blocks[0]["text"]]
        current_y = blocks[0]["y"]

        for i in range(1, len(blocks)):
            block = blocks[i]
            # If the vertical gap is small, it's the same line
            if abs(block["y"] - current_y) > line_threshold:
                lines.append(" ".join(current_words))
                current_words = [block["text"]]
                current_y = block["y"]
            else:
                current_words.append(block["text"])
        
        lines.append(" ".join(current_words))
        return "\n".join(lines)

    # -------------------- Final Assembly --------------------
    # We process the entire left column before starting the right column
    left_text = build_column_text(left_col_blocks)
    right_text = build_column_text(right_col_blocks)

    # Combine them. If there is a right column, append it after the left.
    if right_text:
        return f"{left_text}\n{right_text}"
    return left_text

# -------------------- CLI Interface --------------------
if __name__ == "__main__":
    if len(sys.argv) > 1:
        # We output raw text with single newlines.
        # Your Node.js smartClean will handle the paragraph stitching.
        final_output = process_image(sys.argv[1])
        sys.stdout.write(final_output)
        sys.stdout.flush()