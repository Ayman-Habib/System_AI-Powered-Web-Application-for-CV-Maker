import os
from datetime import datetime
from pathlib import Path
import base64
from flask import render_template
from weasyprint import HTML, CSS

def generate_pdf(cv_data, language="en", template="modern"):
    """
    Generate a PDF using WeasyPrint (HTML → PDF conversion).
    Handles multiple templates (classic / modern / professional),
    supports Arabic RTL, and embeds images automatically.
    """

    def to_base64(path):
        """Convert image file to base64 string"""
        try:
            p = Path(path)
            if not p.exists():
                print(f" Image not found: {path}")
                return ""
            ext = p.suffix[1:].lower() or "png"
            data = base64.b64encode(p.read_bytes()).decode()
            return f"data:image/{ext};base64,{data}"
        except Exception as e:
            print(f" Base64 conversion failed for {path}: {e}")
            return ""

    def embed_images(data):
        """Recursively embed all *_path keys to base64 images"""
        if isinstance(data, dict):
            for k, v in list(data.items()):
                if k.endswith("_path") and v:
                    print(f"🖼️ Processing image path: {v}")
                    
                    # Handle different path formats
                    clean_path = v
                    if v.startswith('/static/uploads/'):
                        clean_path = v[1:]  # Remove leading slash for os.path.join
                    elif v.startswith('static/uploads/'):
                        clean_path = v
                    else:
                        clean_path = f"static/uploads/{os.path.basename(v)}"
                    
                    # Try multiple possible locations
                    possible_paths = [
                        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", clean_path)),
                        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", clean_path)),
                        os.path.abspath(clean_path),
                        os.path.join("static/uploads", os.path.basename(v))
                    ]
                    
                    found_path = None
                    for path in possible_paths:
                        if os.path.exists(path):
                            found_path = path
                            break
                    
                    if found_path:
                        print(f" Found image at: {found_path}")
                        base64_data = to_base64(found_path)
                        if base64_data:
                            data[k.replace("_path", "_base64")] = base64_data
                            print(f" Successfully converted to base64")
                        else:
                            print(f" Base64 conversion failed")
                            data[k.replace("_path", "_base64")] = ""
                    else:
                        print(f" Image file not found in any location: {v}")
                        print(f" Tried paths: {possible_paths}")
                        data[k.replace("_path", "_base64")] = ""
                else:
                    embed_images(v)
        elif isinstance(data, list):
            for item in data:
                embed_images(item)

    try:
        # === Debug: Check incoming data ===
        print(f" [PDF Generator] Starting PDF generation for {language}_{template}")
        print(f" [PDF Generator] Received data keys: {list(cv_data.keys())}")
        if 'personal_info' in cv_data:
            print(f" [PDF Generator] Personal info keys: {list(cv_data['personal_info'].keys())}")
            print(f" [PDF Generator] Photo path: {cv_data['personal_info'].get('photo_path', 'No photo path')}")
        # === Prepare output directory ===
        output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../generated_cvs"))
        os.makedirs(output_dir, exist_ok=True)

        # === Build file name ===
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name = cv_data.get("personal_info", {}).get("name", "CV")
        safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip() or "CV"
        filename = f"cv_{safe_name}_{timestamp}.pdf"
        pdf_path = os.path.join(output_dir, filename)

        # === Embed profile or any image ===
        embed_images(cv_data)

        # === Check if base64 conversion worked ===
        if 'personal_info' in cv_data:
            has_base64 = 'photo_base64' in cv_data['personal_info']
            print(f" [PDF Generator] Base64 conversion successful: {has_base64}")

        # === Choose template dynamically ===
        template_file = f"cv_template_{language}_{template}.html"
        template_path = os.path.join(os.path.dirname(__file__), "../templates", template_file)

        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template not found: {template_file}")

        # === Render template with cv_data ===
        template_vars = cv_data.copy()
        template_vars["lang_class"] = "ar" if language == "ar" else "en"

        html_content = render_template(template_file, **template_vars)

        # === Apply CSS ===
        css_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../static/css/print.css"))
        if os.path.exists(css_path):
            css = CSS(filename=css_path)
        else:
            # Fallback CSS
            base_css = """
            @page { size: A4; margin: 1cm; }
            body {
                font-family: 'Cairo', 'Amiri', 'Noto Naskh Arabic', sans-serif;
                font-size: 12pt;
                line-height: 1.5;
                color: #222;
            }
            """
            if language == "ar":
                base_css += """
                html, body { direction: rtl; text-align: right; }
                h1, h2, h3, h4, h5, p { text-align: right; }
                """
            css = CSS(string=base_css)

        # === Generate the PDF ===
        HTML(string=html_content, base_url=os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))).write_pdf(
            pdf_path, stylesheets=[css]
        )

        print(f" PDF generated successfully: {pdf_path}")
        return pdf_path

    except Exception as e:
        import traceback
        print(f" PDF generation failed: {e}")
        print(traceback.format_exc())
        return None