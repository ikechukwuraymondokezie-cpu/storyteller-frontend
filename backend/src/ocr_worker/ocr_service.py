from flask import Flask, request, jsonify
from paddleocr import PaddleOCR
import os

app = Flask(__name__)

# Initialize PaddleOCR
# use_angle_cls=True helps with rotated text
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

@app.route("/ocr", methods=["POST"])
def process():
    try:
        data = request.get_json()
        image_path = data.get("image_path")

        if not image_path or not os.path.exists(image_path):
            return jsonify({"error": "File not found"}), 400

        # Run OCR
        result = ocr.ocr(image_path, cls=True)

        if not result or not result[0]:
            return jsonify({"text": ""})

        # 1. Extract blocks with coordinates: [x, y, text]
        # Paddle structure: [ [[ [x1,y1],[x2,y2],[x3,y3],[x4,y4] ], (text, score)] ]
        page_blocks = []
        for line in result[0]:
            box = line[0]
            text = line[1][0]
            y_top = box[0][1]
            x_left = box[0][0]
            page_blocks.append({"text": text, "x": x_left, "y": y_top})

        # 2. Sort blocks: First by Y (top to bottom), then by X (left to right)
        # We use a small threshold (10px) so that words on the same line 
        # stay together even if they are slightly unaligned.
        page_blocks.sort(key=lambda b: (round(b['y'] / 10), b['x']))

        # 3. Join text
        ordered_text = ""
        last_y = -1
        for block in page_blocks:
            # If the Y change is significant, start a new paragraph
            if last_y != -1 and block['y'] - last_y > 20:
                ordered_text += "\n\n" + block['text']
            else:
                ordered_text += " " + block['text']
            last_y = block['y']

        return jsonify({
            "text": ordered_text.strip()
        })

    except Exception as e:
        print(f"OCR Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # threaded=True allows it to handle the 'Promise.all' calls from Node
    app.run(port=5001, threaded=True)