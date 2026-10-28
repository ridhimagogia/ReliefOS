
import pytesseract
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

def read_request(image_path):
    return pytesseract.image_to_string(Image.open(image_path))

if __name__ == "__main__":
    text = read_request("request.png")
    print("Extracted text:", text)
