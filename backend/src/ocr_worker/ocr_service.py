import sys
import os
import logging
import warnings
import numpy as np

# Suppress logs
os.environ['GLOG_minloglevel'] = '3'
logging.disable(logging.CRITICAL)
warnings.filterwarnings("ignore")

try:
    from paddleocr import PaddleOCR
except ImportError:
    sys.exit(0)

ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False, use_gpu=False)

def find_gutter(blocks, max_x):
    """Finds the widest vertical empty space to split columns."""
    if not blocks: return max_x / 2
    
    # Create a histogram of occupied X-coordinates
    x_hist = np.zeros(int(max_x) + 1)
    for b in blocks:
        x_hist[int(b['x_start']):int(b['x_end'])] = 1
    
    # Find the longest run of zeros (empty space) near the middle
    zero_runs = []
    current_run = 0
    start_idx = 0
    
    for i, val in enumerate(x_hist):
        if val == 0:
            if current_run == 0: start_idx = i
            current_run += 1
        else:
            if current_run > 20: # Only care about gaps wider than 20px
                zero_runs.append((start_idx, current_run))
            current_run = 0
            
    if not zero_runs: return max_x / 2
    
    # Pick the gap closest to the center of the page
    center = max_x / 2
    best_gap_mid = center
    min_dist = max_x
    
    for start, length in zero_runs:
        gap_mid = start + (length / 2)
        dist = abs(gap_mid - center)
        if dist < min_dist:
            min_dist = dist
            best_gap_mid = gap_mid
            
    return best_gap_mid

def process_image(image_path, line_threshold=15):
    if not os.path.exists(image_path): return ""

    result = ocr.ocr(image_path, cls=True)
    if not result or not result[0]: return ""

    page_blocks = []
    max_x = 0
    for line in result[0]:
        box, (text, score) = line
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        
        x_start, x_end = min(xs), max(xs)
        if x_end > max_x: max_x = x_end
        
        page_blocks.append({
            "text": text.strip(),
            "x_start": x_start,
            "x_end": x_end,
            "x_center": (x_start + x_end) / 2,
            "y": min(ys)
        })

    # DYNAMIC GUTTER DETECTION
    gutter_x = find_gutter(page_blocks, max_x)
    
    left_col = [b for b in page_blocks if b["x_center"] < gutter_x]
    right_col = [b for b in page_blocks if b["x_center"] >= gutter_x]

    # Sort
    left_col.sort(key=lambda b: (round(b["y"] / line_threshold), b["x_start"]))
    right_col.sort(key=lambda b: (round(b["y"] / line_threshold), b["x_start"]))

    def merge(blocks):
        if not blocks: return ""
        res = []
        curr_words = [blocks[0]["text"]]
        curr_y = blocks[0]["y"]
        for i in range(1, len(blocks)):
            if abs(blocks[i]["y"] - curr_y) > line_threshold:
                res.append(" ".join(curr_words))
                curr_words = [blocks[i]["text"]]
                curr_y = blocks[i]["y"]
            else:
                curr_words.append(blocks[i]["text"])
        res.append(" ".join(curr_words))
        return "\n".join(res)

    left_text = merge(left_col)
    right_text = merge(right_col)

    return f"{left_text}\n{right_text}".strip()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        sys.stdout.write(process_image(sys.argv[1]))
        sys.stdout.flush()