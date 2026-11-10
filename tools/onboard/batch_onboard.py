import requests
import base64
import os
import sys
import json
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

GATEWAY_URL = "http://localhost/api/ai"
SAMPLE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sample"))

def onboard_image(file_path):
    file_name = os.path.basename(file_path)
    print(f"\n>>> Processing {file_name}...")
    
    with open(file_path, "rb") as f:
        image_bytes = f.read()
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    # 1. Scan
    scan_payload = {
        "base64Image": base64_image,
        "sampleId": f"batch_{file_name}"
    }
    
    try:
        response = requests.post(f"{GATEWAY_URL}/onboard/scan", json=scan_payload)
        if response.status_code != 200:
            print(f"!!! Scan failed for {file_name}: {response.status_code} {response.text}")
            return False
        
        suggestion = response.json().get("data")
        if not suggestion:
            print(f"!!! No suggestion returned for {file_name}")
            return False
        
        print(f"Scan success: {suggestion.get('name')} (Price: {suggestion.get('price')})")
        
        # 2. Confirm
        confirm_response = requests.post(f"{GATEWAY_URL}/onboard/confirm", json=suggestion)
        if confirm_response.status_code != 200:
            print(f"!!! Confirm failed for {file_name}: {confirm_response.status_code} {confirm_response.text}")
            return False
        
        product = confirm_response.json().get("data")
        print(f"Successfully onboarded: {product.get('name')} (ID: {product.get('productId')})")
        return True
        
    except Exception as e:
        print(f"!!! Error processing {file_name}: {e}")
        return False

def main():
    images = [f for f in os.listdir(SAMPLE_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    images.sort()
    
    success_count = 0
    for img_name in images:
        path = os.path.join(SAMPLE_DIR, img_name)
        if onboard_image(path):
            success_count += 1
        # Sleep a bit to avoid hitting LLM rate limits or overloading
        time.sleep(1)
    
    print(f"\nBatch processing complete. Success: {success_count}/{len(images)}")

if __name__ == "__main__":
    main()
