
import base64

try:
    with open('assets/logo.png', 'rb') as img_file:
        b64_string = base64.b64encode(img_file.read()).decode('utf-8')
    
    js_content = f'const LOGO_BASE64 = "data:image/png;base64,{b64_string}";'
    
    with open('assets/logo-data.js', 'w') as js_file:
        js_file.write(js_content)
        
    print("Successfully created assets/logo-data.js")
except Exception as e:
    print(f"Error: {e}")
