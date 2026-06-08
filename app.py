import os
import re
import requests
import time
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, send_file
from utils.pdf_generator_weasy import generate_pdf  # Ensure you have this module

# === Initialize Flask ===
app = Flask(__name__)
load_dotenv()

# === Configuration ===
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 4 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('generated_cvs', exist_ok=True)

# === OpenRouter / DeepSeek API ===
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
# Multiple endpoint options for fallback
API_ENDPOINTS = [
    "https://api.openrouter.ai/api/v1/chat/completions",  # Primary
    "https://openrouter.ai/api/v1/chat/completions",     # Alternative
]
MAX_FIELD_LENGTH = 600

# === DNS Resilient Request Function ===
def make_dns_resilient_request(url, headers, payload, max_retries=3):
    """Make API request with DNS failure handling and retries"""
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response
            
        except requests.exceptions.ConnectionError as e:
            if "NameResolutionError" in str(e) or "getaddrinfo failed" in str(e):
                print(f"[DNS ERROR] Attempt {attempt + 1}: Failed to resolve {url}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"[INFO] Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    raise Exception(f"DNS resolution failed after {max_retries} attempts")
            else:
                raise e
                
        except requests.exceptions.Timeout:
            print(f"[TIMEOUT] Attempt {attempt + 1}: Request timed out")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            else:
                raise Exception("Request timeout after multiple attempts")
                
        except Exception as e:
            print(f"[ERROR] Attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            else:
                raise e
    
    raise Exception("All retry attempts failed")

# === Utilities ===
def detect_language(text):
    return "ar" if re.search(r"[\u0600-\u06FF]", text) else "en"

def truncate_fields(data):
    """Truncate very long text fields to prevent template rendering issues"""
    personal_info = data.get('personal_info', {})
    if 'summary' in personal_info and personal_info['summary']:
        if len(personal_info['summary']) > 1500:
            personal_info['summary'] = personal_info['summary'][:1500] + '...'

    for exp in data.get('experience', []):
        if isinstance(exp, dict) and 'description' in exp and exp['description']:
            if len(exp['description']) > 500:
                exp['description'] = exp['description'][:500] + '...'

    for edu in data.get('education', []):
        if isinstance(edu, dict) and 'description' in edu and edu['description']:
            if len(edu['description']) > 300:
                edu['description'] = edu['description'][:300] + '...'

    skills = data.get('skills', '')
    if isinstance(skills, str) and len(skills) > 500:
        data['skills'] = skills[:500] + '...'

    return data

def create_basic_preview(cv_data, language="en"):
    """Create a basic HTML preview when templates fail"""
    if language == "ar":
        html = """
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc;">
            <h2>معاينة السيرة الذاتية</h2>
            <p><strong>ملاحظة:</strong> عرض أساسي بسبب مشكلة في القالب</p>
        """
    else:
        html = """
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc;">
            <h2>CV Preview</h2>
            <p><strong>Note:</strong> Basic preview due to template issue</p>
        """
    
    # Add personal info
    personal_info = cv_data.get('personal_info', {})
    if personal_info:
        if language == "ar":
            html += "<h3>المعلومات الشخصية</h3>"
            html += f"<p><strong>الاسم:</strong> {personal_info.get('name', '')}</p>"
            html += f"<p><strong>البريد الإلكتروني:</strong> {personal_info.get('email', '')}</p>"
            html += f"<p><strong>الهاتف:</strong> {personal_info.get('phone', '')}</p>"
        else:
            html += "<h3>Personal Information</h3>"
            html += f"<p><strong>Name:</strong> {personal_info.get('name', '')}</p>"
            html += f"<p><strong>Email:</strong> {personal_info.get('email', '')}</p>"
            html += f"<p><strong>Phone:</strong> {personal_info.get('phone', '')}</p>"
    
    html += "</div>"
    return html

# === Smart fallback generator ===
def generate_smart_fallback_content(
    field_type,
    language="en",
    job_title="",
    job_info="",
    organization="",
    start_date="",
    end_date="",
    target_job_title="" 
):
    job_title = job_title.strip() or "Professional"
    target_job = target_job_title.strip() or job_title  # استخدام الوظيفة المستهدفة أو الحالية
    organization = organization.strip() or "an organization"
    period = f" ({start_date or ''} – {end_date or 'Present'})" if (start_date or end_date) else ""
    degree = job_info.strip() or "Degree"
    period_text = f" ({end_date})" if end_date else ""

    if language == "ar":
        templates = {
            "summary": f"ملخص مهني احترافي لشخص يعمل كـ '{job_title}' ويتقدم لـ '{target_job}' في '{organization}'.",
            "experience": f"عمل كـ '{job_title}' في '{job_info}'{period}، حيث اكتسب خبرة تناسب متطلبات '{target_job}' في '{organization}'.",
            "education": f"حاصل على '{degree}' من '{job_info}'{period_text}، حيث اكتسب معرفة نظرية وعملية تناسب متطلبات '{target_job}' في '{organization}'.",
            "skills": f"مهارات مهنية تتناسب مع وظيفة '{target_job}' في '{organization}'.",
            "extra_info": f"أنشطة إضافية واهتمامات شخصية تتماشى مع '{organization}' و'{target_job}'.",
            "job_title": job_title,
            "target_job_title": target_job
        }
    else:
        templates = {
            "summary": f"Professional summary for a '{job_title}' applying for '{target_job}' at '{organization}', highlighting expertise and results.",
            "experience": f"Worked as a '{job_title}' at '{job_info}'{period}, gaining experience relevant to '{target_job}' at '{organization}'.",
            "education": f"Academic qualification '{degree}' from '{job_info}'{period_text}, providing knowledge and skills relevant to '{target_job}' at '{organization}'.",
            "skills": f"Key skills relevant to the '{target_job}' position at '{organization}'.",
            "extra_info": f"Additional information relevant to '{organization}' and '{target_job}'.",
            "job_title": job_title,
            "target_job_title": target_job
        }

    text = templates.get(field_type, templates["summary"])
    return {"enhanced_text": text, "suggestions": {"note": "Smart fallback used."}}

# === Build Enhancement Prompt ===
def build_enhancement_prompt(prompt, field_type, language, job_title="", job_info="", style_level=1, organization="", start_date="", end_date="", target_job_title="",extra_item=None):
    if language == "ar":
        base_instruction = (
            "أنت خبير محترف في كتابة السير الذاتية باللغة العربية الفصحى. "
            "اكتب جميع الإجابات باللغة العربية فقط، بأسلوب رسمي، موجز، واحترافي. "
            "لا تستخدم العلامات النجمية (**) أو تضع عناوين. "
            "ركز على كتابة نصوص مختصرة ومناسبة للمتقدمين للوظائف."
        )
    else:
        base_instruction = (
            f"You are a professional resume-writing assistant. Respond only in English. "
            f"Do not use asterisks (**) or add titles. "
            f"Focus on writing concise texts suitable for job applicants."
            f"IMPORTANT: Always use the exact organization name '{organization}' wherever 'organization' is referenced. "
            f"Do NOT replace it with 'organization', 'company', or anything else. Keep '{organization}' verbatim in the output."
)
        

    # استخدام الوظيفة المستهدفة إذا كانت متاحة، وإلا استخدام المسمى الحالي
    current_job_title = job_title.strip() or job_info.strip() or ("محترف" if language == "ar" else "Professional")

    target_job = target_job_title.strip() or current_job_title
    organization = organization.strip() or "منظمة" if language == "ar" else "an organization"
    period = f" ({start_date or ''} – {end_date or 'Present'})" if (start_date or end_date) else ""
    has_text = bool(prompt and prompt.strip())

    if field_type == "summary":
        if language == "ar":
            if has_text:
                return f"""{base_instruction}
المهمة: تحسين الملخص المهني مع التركيز على:
1. جعل الملخص مناسباً للوظيفة المستهدفة: {target_job}
2. جعل الملخص مناسباً للشركة المستهدفة: {organization}
3. تعديل النص المدخل مع الحفاظ على الأفكار الرئيسية
4. كتابة ملخص مختصر ومهني
5. الإشارة بوضوح للوظيفة المستهدفة والشركة المستهدفة
6. اجعل النص النهائي بين 10 و 2000 حرفًا، مختصرًا، متماسكًا، ومناسبًا لسيرة ذاتية احترافية
المعلومات المتاحة:
- المسمى الوظيفي الحالي: {current_job_title}
- الوظيفة المستهدفة: {target_job}
- الشركة المستهدفة: {organization}

النص الحالي:
{prompt}

الرجاء كتابة ملخص مهني مختصر مع الإشارة الواضحة للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
            else:
                return f"""{base_instruction}
المهمة: كتابة ملخص مهني مناسب للوظيفة والشركة المستهدفة.

المعلومات المتاحة:
- المسمى الوظيفي الحالي: {current_job_title}
- الوظيفة المستهدفة: {target_job}
- الشركة المستهدفة: {organization}

الرجاء كتابة ملخص مهني مختصر مع الإشارة الواضحة للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
        else:
            if has_text:
                return f"""{base_instruction}
Task: Enhance professional summary focusing on:
1. Making the summary suitable for target job: {target_job}
2. Making the summary suitable for target organization: {organization}
3. Modifying the input text while preserving main ideas
4. Writing a brief and professional summary
5. Clearly referencing the target job and target organization
6.Write the output to be between 10 and 2000 characters, concise, coherent, and suitable for a professional resume.
Available Information:
- Current Job Title: {current_job_title}
- Target Job: {target_job}
- Target Organization: {organization}

Current Text:
{prompt}

Please write a brief professional summary with clear reference to target job '{target_job}' and target organization '{organization}'."""
            else:
                return f"""{base_instruction}
Task: Write a professional summary suitable for the target job and organization.

Available Information:
- Current Job Title: {current_job_title}
- Target Job: {target_job}
- Target Organization: {organization}

Please write a brief professional summary with clear reference to target job '{target_job}' and target organization '{organization}'."""

    elif field_type == "experience":
        if language == "ar":
            if has_text:
                return f"""{base_instruction}
المهمة: تحسين نص الخبرة العملية مع التركيز على:
1. تصحيح الأخطاء الإملائية في المسمى الوظيفي فقط
2. كتابة وصف مختصر للمسيرة المهنية
3. استخدام التواريخ والشركات المذكورة
4. جعل النص مناسباً للشركة المستهدفة: {organization}
5. ربط الخبرات السابقة بالوظيفة المستهدفة: {target_job}
6. الإشارة بوضوح للشركة المستهدفة والوظيفة المستهدفة
7. توضيح كيف تؤهل هذه الخبرة للوظيفة المستهدفة في الشركة المستهدفة
8.اجعل النص النهائي بين 10 و 2000 حرفًا، مختصرًا، متماسكًا، ومناسبًا لسيرة ذاتية احترافية
المعلومات المتاحة:
- المسمى الوظيفي في هذه الخبرة: {job_title}
- الشركة التي عمل بها: {job_info}
- الوظيفة المستهدفة: {target_job}
- الشركة المستهدفة: {organization}
- الفترة: {period}

النص الحالي:
{prompt}

الرجاء كتابة وصف مختصر يلخص المسيرة المهنية مع:
• ربط الخبرات بالوظيفة المستهدفة '{target_job}'
• الإشارة الواضحة للشركة المستهدفة '{organization}'
• توضيح كيف تؤهل هذه الخبرة للنجاح في {organization} كـ {target_job}""" 
            else:
                return f"""{base_instruction}
المهمة: كتابة وصف مختصر للخبرة العملية مناسب للوظيفة والشركة المستهدفة.

المعلومات المتاحة:
- المسمى الوظيفي في هذه الخبرة: {job_title}
- الشركة التي عمل بها: {job_info}
- الوظيفة المستهدفة: {target_job}
- الشركة المستهدفة: {organization}
- الفترة: {period}

الرجاء كتابة وصف مختصر يلخص المسيرة المهنية مع:
• ربط الخبرات بالوظيفة المستهدفة '{target_job}'
• الإشارة الواضحة للشركة المستهدفة '{organization}'
• توضيح كيف تؤهل هذه الخبرة للنجاح في {organization} كـ {target_job}"""  
        else:
            if has_text:
                return f"""{base_instruction}
Task: Enhance work experience description focusing on:
1. Correct spelling errors in job title only
2. Write a brief career summary
3. Use the mentioned dates and companies
4. Make the text suitable for target organization: {organization}
5. Relate previous experience to target job: {target_job}
6. Clearly reference the target organization and target job
7. Explain how this experience qualifies for the target job at the target organization
8.Write the output to be between 10 and 2000 characters, concise, coherent, and suitable for a professional resume.
Available Information:
- Job Title in this Experience: {job_title}
- Company Worked At: {job_info}
- Target Job: {target_job}
- Target Organization: {organization}
- Period: {period}

Current Text:
{prompt}

Please write a brief summary of the career path with:
• Relating experience to target job '{target_job}'
• Clear reference to target organization '{organization}'
• Explaining how this experience qualifies for success at {organization} as {target_job}"""  
            else:
                return f"""{base_instruction}
Task: Write a brief work experience description suitable for the target job and organization.

Available Information:
- Job Title in this Experience: {job_title}
- Company Worked At: {job_info}
- Target Job: {target_job}
- Target Organization: {organization}
- Period: {period}

Please write a brief summary of the career path with:
• Relating experience to target job '{target_job}'
• Clear reference to target organization '{organization}'
• Explaining how this experience qualifies for success at {organization} as {target_job}"""  

    elif field_type == "education":
        # === استخراج الدرجة والمؤسسة التعليمية بشكل دقيق ===
        degree = ""
        institution = ""

        # إذا كانت البيانات عبارة عن قاموس (وهو الشكل الصحيح القادم من النموذج)
        if isinstance(job_info, dict):
            degree = (job_info.get("degree") or job_info.get("qualification") or "").strip()
            institution = (job_info.get("institution") or job_info.get("university") or job_info.get("school") or "").strip()
        # إذا كانت البيانات نصية فقط
        elif isinstance(job_info, str):
            if ' - ' in job_info:
                parts = job_info.split(' - ', 1)
                degree = parts[0].strip()
                institution = parts[1].strip()
            elif '|' in job_info:
                parts = job_info.split('|', 1)
                degree = parts[0].strip()
                institution = parts[1].strip()
            else:
                degree = job_info.strip()

        # قيم افتراضية عند غياب البيانات
        if not degree:
            degree = "شهادة" if language == "ar" else "Degree"
        if not institution:
            institution = "جامعة" if language == "ar" else "University"

        period_start = start_date or ""
        period_end = end_date or ""
        education_status = ""
        if end_date:
            try:
                from datetime import datetime
                end_year, end_month = map(int, end_date.split('-'))
                end_obj = datetime(end_year, end_month, 1)
                if end_obj < datetime.now():
                    education_status = "completed"
                else:
                    education_status = "in_progress"
            except Exception:
                education_status = "unknown"
        else:
            education_status = "in_progress"

        #  ترجمة الحالة
        if language == "ar":
            if education_status == "completed":
                education_status_text = "منتهٍ"
            elif education_status == "in_progress":
                education_status_text = "قيد الدراسة"
            else:
                education_status_text = "غير محدد"
        else:
            if education_status == "completed":
                education_status_text = "completed"
            elif education_status == "in_progress":
                education_status_text = "in progress"
            else:
                education_status_text = "unknown"

        # ====== النص العربي ======
        if language == "ar":
            if has_text:
                return f"""{base_instruction}
المهمة: تحسين النص التعليمي مع التركيز على:
1. استخدام الدرجة العلمية: {degree}
2. استخدام المؤسسة التعليمية: {institution}
3. ذكر المدة الدراسية من {period_start or 'تاريخ البداية غير محدد'} إلى {period_end or 'الآن'}
4. جعل النص مناسباً للوظيفة المستهدفة: {target_job}
5. جعل النص مناسباً للشركة المستهدفة: {organization}
6. تصحيح أي خطأ في الخلط بين المؤسسة التعليمية والشركة المستهدفة
7. التأكد من أن المؤسسة التعليمية هي مصدر الشهادة والشركة المستهدفة هي جهة العمل المستقبلية
8. ربط التعليم بالوظيفة المستهدفة والشركة المستهدفة
9. الإشارة بوضوح للوظيفة المستهدفة والشركة المستهدفة
10. توضيح كيف يؤهل هذا التعليم للوظيفة المستهدفة في الشركة المستهدفة
11. اجعل النص النهائي بين 10 و 2000 حرفًا، مختصرًا، متماسكًا، ومناسبًا لسيرة ذاتية احترافية

النص الحالي:
{prompt}
حالة التعليم: {education_status_text}

الرجاء كتابة وصف مختصر للخبرة التعليمية مع:
• ذكر الدرجة العلمية '{degree}'
• ذكر المؤسسة التعليمية '{institution}'
• ذكر المدة الدراسية من {period_start or 'تاريخ البداية غير محدد'} إلى {period_end or 'الآن'}
• ربط التعليم بالوظيفة المستهدفة '{target_job}'
• الإشارة الواضحة للشركة المستهدفة '{organization}'
• توضيح كيف يؤهل هذا التعليم للنجاح في {organization} كـ {target_job}
• التمييز بين المؤسسة التعليمية {institution} والشركة المستهدفة {organization}"""
            else:
                return f"""{base_instruction}
المهمة: كتابة وصف مختصر للخبرة التعليمية مناسب للوظيفة والشركة المستهدفة.

المعلومات المتاحة:
- الدرجة العلمية: {degree}
- المؤسسة التعليمية: {institution}
- المدة الدراسية: من {period_start or 'تاريخ البداية غير محدد'} إلى {period_end or 'الآن'}
- الوظيفة المستهدفة: {target_job}
- الشركة المستهدفة: {organization}
- حالة التعليم: {education_status_text}

الرجاء كتابة وصف مختصر للخبرة التعليمية مع:
• ذكر الدرجة العلمية '{degree}'
• ذكر المؤسسة التعليمية '{institution}'
• ذكر المدة الدراسية من {period_start or 'تاريخ البداية غير محدد'} إلى {period_end or 'الآن'}
• ربط التعليم بالوظيفة المستهدفة '{target_job}'
• الإشارة الواضحة للشركة المستهدفة '{organization}'
• توضيح كيف يؤهل هذا التعليم للنجاح في {organization} كـ {target_job}
• التمييز بين المؤسسة التعليمية {institution} والشركة المستهدفة {organization}"""

        # ====== النص الإنجليزي ======
        else:
            if has_text:
                return f"""{base_instruction}
Task: Enhance education description focusing on:
1. Using the degree: {degree}
2. Using the educational institution: {institution}
3. Mentioning study period from {period_start or 'start date not provided'} to {period_end or 'Present'}
4. Making the text suitable for target job: {target_job}
5. Making the text suitable for target organization: {organization}
6. Correcting any confusion between educational institution and target organization
7. Ensuring educational institution is the degree source and target organization is the future workplace
8. Relating education to target job and target organization
9. Clearly referencing the target job and target organization
10. Explaining how this education qualifies for the target job at {organization}
11. Write the output to be between 10 and 2000 characters, concise, coherent, and suitable for a professional resume.

Current Text:
{prompt}


Please write a brief education description with:
Education Status: {education_status}
• Mentioning degree '{degree}'
• Mentioning institution '{institution}'
• Mentioning study period from {period_start or 'start date not provided'} to {period_end or 'Present'}
• Relating education to target job '{target_job}'
• Clear reference to target organization '{organization}'
• Explaining how this education qualifies for success at {organization} as {target_job}
• Distinguishing between educational institution {institution} and target organization {organization}"""
            else:
                return f"""{base_instruction}
Task: Write a brief education description suitable for the target job and organization.

Available Information:
- Degree: {degree}
- Institution: {institution}
- Study Period: from {period_start or 'start date not provided'} to {period_end or 'Present'}
- Target Job: {target_job}
- Target Organization: {organization}
- Education Status: {education_status_text}

Please write a brief education description with:
• Mentioning degree '{degree}'
• Mentioning institution '{institution}'
• Mentioning study period from {period_start or 'start date not provided'} to {period_end or 'Present'}
• Relating education to target job '{target_job}'
• Clear reference to target organization '{organization}'
• Explaining how this education qualifies for success at {organization} as {target_job}
• Distinguishing between educational institution {institution} and target organization {organization}"""

    elif field_type == "skills":
        if language == "ar":
            if has_text:
                return f"""{base_instruction}
المهمة: تحسين نص المهارات مع التركيز على:
1. جعل المهارات مناسبة للوظيفة المستهدفة: {target_job}
2. جعل المهارات مناسبة للشركة المستهدفة: {organization}
3. تعديل النص المدخل مع الحفاظ على المهارات الأساسية
4. كتابة نص مختصر ومهني
5. الإشارة بوضوح للوظيفة المستهدفة والشركة المستهدفة
6.اجعل النص النهائي بين 10 و 2000 حرفًا، مختصرًا، متماسكًا، ومناسبًا لسيرة ذاتية احترافية
النص الحالي:
{prompt}

الرجاء كتابة قائمة مختصرة للمهارات المناسبة للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
            else:
                return f"""{base_instruction}
المهمة: كتابة قائمة مهارات مناسبة للوظيفة والشركة المستهدفة.

الوظيفة المستهدفة: {target_job}
الشركة المستهدفة: {organization}

الرجاء كتابة قائمة مختصرة للمهارات المناسبة للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
        else:
            if has_text:
                return f"""{base_instruction}
Task: Enhance skills text focusing on:
1. Making skills suitable for target job: {target_job}
2. Making skills suitable for target organization: {organization}
3. Modifying the input text while preserving core skills
4. Writing a brief and professional text
5. Clearly referencing the target job and target organization
6.Write the output to be between 10 and 2000 characters, concise, coherent, and suitable for a professional resume.
Current Text:
{prompt}

Please write a brief skills list suitable for target job '{target_job}' and target organization '{organization}'."""
            else:
                return f"""{base_instruction}
Task: Write a skills list suitable for the target job and organization.

Target Job: {target_job}
Target Organization: {organization}

Please write a brief skills list suitable for target job '{target_job}' and target organization '{organization}'."""

    elif field_type in ["extra", "extra_info"]:
        title = extra_item.get("title", "Additional Information") if extra_item else "Additional Information"
        if language == "ar":
            if has_text:
                return f"""{base_instruction}
المهمة: تحسين النص الإضافي مع التركيز على:
1. جعل النص مناسباً للوظيفة المستهدفة: {target_job}
2. جعل النص مناسباً للشركة المستهدفة: {organization}
3. تعديل النص المدخل مع الحفاظ على الفكرة الرئيسية
4. كتابة نص مختصر ومهني
5. الإشارة بوضوح للوظيفة المستهدفة والشركة المستهدفة
6.اجعل النص النهائي بين 10 و 2000 حرفًا، مختصرًا، متماسكًا، ومناسبًا لسيرة ذاتية احترافية
القسم: {title}
النص الحالي:
{prompt}

الرجاء كتابة وصف مختصر للمعلومات الإضافية مع الإشارة للقسم '{title}', الوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
            else:
                return f"""{base_instruction}
المهمة: كتابة نص للمعلومات الإضافية مناسب للوظيفة والشركة المستهدفة.

الوظيفة المستهدفة: {target_job}
الشركة المستهدفة: {organization}

الرجاء كتابة وصف مختصر للمعلومات الإضافية مع الإشارة للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
        else:
            if has_text:
                return f"""{base_instruction}
Task: Enhance additional information text focusing on:
1. Making the text suitable for target job: {target_job}
2. Making the text suitable for target organization: {organization}
3. Modifying the input text while preserving the main idea
4. Writing a brief and professional text
5. Clearly referencing the target job and target organization
6.Write the output to be between 10 and 2000 characters, concise, coherent, and suitable for a professional resume.
Section: {title}
Current Text:
{prompt}

Please write a brief description of additional information with reference to section '{title}', target job '{target_job}' and target organization '{organization}'."""
            else:
                return f"""{base_instruction}
Task: Write additional information text suitable for the target job and organization.

Target Job: {target_job}
Target Organization: {organization}

Please write a brief description of additional information with reference to target job '{target_job}' and target organization '{organization}'."""

    else:
        # Default case for other field types
        if language == "ar":
            return f"""{base_instruction}
قم بتحسين النص التالي ليكون مناسباً للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}':

النص الحالي:
{prompt}

الرجاء كتابة نص محسن مع الإشارة للوظيفة المستهدفة '{target_job}' والشركة المستهدفة '{organization}'."""
        else:
            return f"""{base_instruction}
Enhance the following text to be suitable for target job '{target_job}' and target organization '{organization}':

Current Text:
{prompt}

Please write enhanced text with reference to target job '{target_job}' and target organization '{organization}'."""

# === Improved API Call Function ===
def call_deepseek_api(prompt, language=None, is_auto_fill=False, field_type=None, job_title="", job_info="", organization="", start_date="", end_date="", target_job_title=""):
    if not language:
        language = detect_language(prompt or "")

    if not DEEPSEEK_API_KEY:
        print("[INFO] No API key — using fallback")
        return generate_smart_fallback_content(field_type, language, job_title, job_info, organization, start_date, end_date, target_job_title)

    system_message = (
        "أنت خبير محترف في كتابة السير الذاتية باللغة العربية الفصحى. "
        "اكتب جميع الإجابات باللغة العربية فقط، بأسلوب رسمي، موجز، واحترافي. "
        "لا تستخدم العلامات النجمية (**) أو تضع عناوين. "
        "ركز على كتابة نصوص مختصرة ومناسبة للمتقدمين للوظائف. "
        "للتعليم: تأكد من التمييز بين المؤسسة التعليمية (الجامعة/الكلية) والشركة المستهدفة (مكان العمل). "
        "لا تخلط بينهما - المؤسسة التعليمية هي مصدر الشهادة، والشركة المستهدفة هي جهة العمل المستقبلية. "
        "لجميع الحقول: استخدم المعلومات المتاحة (المسمى الوظيفي، الدرجة العلمية، المؤسسة) "
        "واشر دائماً للشركة المستهدفة في النصوص المحسنة."
        if language == "ar" else
        "You are a professional resume-writing assistant. Respond only in English. "
        "Do not use asterisks (**) or add titles. "
        "Focus on writing concise texts suitable for job applicants. "
        "For education: Ensure clear distinction between educational institution (university/college) and target organization (workplace). "
        "Do not confuse them - educational institution is the degree source, target organization is the future workplace. "
        "For all fields: Use available information (job title, degree, institution) "
        "and always reference the target organization in enhanced texts."
    )

    max_tokens_map = {"summary": 300, "experience": 400, "education": 250, "skills": 150, "extra_info": 150, "job_title": 30}
    max_tokens = max_tokens_map.get(field_type, 100)

    payload = {
        "model": "deepseek/deepseek-chat", 
        "messages": [
            {"role": "system", "content": system_message}, 
            {"role": "user", "content": prompt}
        ], 
        "temperature": 0.6, 
        "max_tokens": max_tokens
    }
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}", 
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app.com",  # Required by OpenRouter
        "X-Title": "CV Builder App"
    }

    # Try multiple endpoints
    for endpoint in API_ENDPOINTS:
        try:
            print(f"[INFO] Trying endpoint: {endpoint}")
            response = make_dns_resilient_request(endpoint, headers, payload)
            data = response.json()
            enhanced_text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            if not enhanced_text:
                print("[WARNING] Empty response from API")
                continue  # Try next endpoint

            if language == "ar" and not re.search(r"[\u0600-\u06FF]", enhanced_text):
                print("[WARNING] Arabic prompt but non-Arabic response")
                continue  # Try next endpoint

            #if len(enhanced_text) > MAX_FIELD_LENGTH:
             #   enhanced_text = enhanced_text[:MAX_FIELD_LENGTH].rstrip() + "..."

            print(f"[SUCCESS] Got response from {endpoint}")
            return {"enhanced_text": enhanced_text, "suggestions": {}}

        except Exception as e:
            print(f"[ERROR] Endpoint {endpoint} failed: {e}")
            continue  # Try next endpoint

    # If all endpoints fail, use fallback
    print("[INFO] All API endpoints failed, using fallback content")
    return generate_smart_fallback_content(field_type, language, job_title, job_info, organization, start_date, end_date, target_job_title)

# === Routes ===
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/enhance", methods=["POST"])
def enhance_field():
    try:
        data = request.get_json(force=True)
        start_date = ""
        end_date = ""
        extra_item = data.get("extra_item", None)
        target_job_title = data.get("target_job_title", "")

        # FIX EXPERIENCE INPUT EXTRACTION
        if data.get("field_type") == "experience":
            exp_item = data.get("experience_item", {})

            # Extract job title (Teacher, Accountant, etc.)
            job_title = exp_item.get("title", "").strip()

            # Extract company or description
            job_info = (
                exp_item.get("company")
                or exp_item.get("organization")
                or exp_item.get("description")
                or ""
            )

            # Extract dates if sent
            start_date = exp_item.get("start_date", "")
            end_date = exp_item.get("end_date", "")

            print("[EXPERIENCE FIX] Extracted experience item:")
            print(f"  Title: {job_title}")
            print(f"  Job Info: {job_info}")
            print(f"  Dates: {start_date} - {end_date}")

        
        # البيانات الأساسية
        prompt = (data.get("prompt") or "").strip()
        language = data.get("language", "en").strip().lower()
        field_type = data.get("field_type", "general").strip().lower()
        # --- handle education field properly ---
        if field_type == "education":
            edu_item = data.get("education_item", {})

            degree = edu_item.get("degree", "").strip()
            institution = edu_item.get("institution", "").strip()
            start_date = edu_item.get("start_date", "")
            end_date = edu_item.get("end_date", "")

            # اجمع معلومات التعليم في قاموس واحد
            job_info = {
                "degree": degree,
                "institution": institution
            }

            print(f"[EDUCATION FIX] degree={degree}, institution={institution}, start={start_date}, end={end_date}")

        organization = (data.get("organization") or "").strip()
        target_job_title = (data.get("target_job_title") or "").strip()  
        
        # البيانات المشتركة - إصلاح معالجة job_info
        job_title = data.get("job_title", "").strip()
        job_title = job_title or target_job_title or "Applicant"


        
        # معالجة job_info بشكل آمن
        job_info_raw = data.get("job_info", "")
        if field_type == "education" and isinstance(job_info_raw, dict):
            job_info = job_info_raw
        if isinstance(job_info_raw, dict):
            job_info = str(job_info_raw)  # تحويل dictionary إلى string
        elif isinstance(job_info_raw, list):
            job_info = " ".join(str(item) for item in job_info_raw)
        else:
            job_info = str(job_info_raw).strip()
        
        # لا تعيد الكتابة إذا كانت القيم قد التقطت من education_item أو experience_item
        if not start_date:
            start_date = data.get("start_date", "")
        if not end_date:
            end_date = data.get("end_date", "")

        
        print(f"[ENHANCE] Field Type: {field_type}")
        print(f"[ENHANCE] Language: {language}")
        print(f"[ENHANCE] Organization: {organization}")
        print(f"[ENHANCE] Target Job Title: {target_job_title}")
        print(f"[ENHANCE] Job Title: {job_title}")
        print(f"[ENHANCE] Job Info: {job_info} (type: {type(job_info_raw)})")
        print(f"[ENHANCE] Dates: {start_date} - {end_date}")
        if field_type.lower() == "summary" and organization and organization.strip():
            # Only append if the organization name is not already in the prompt
            if organization.lower() not in prompt.lower():
                prompt += f" (Target Organization: {organization})"
        if field_type.startswith("extra"):
            # fallback in case extra_item is missing
            title = extra_item.get("title", "Additional Information") if extra_item else "Additional Information"
            desc = extra_item.get("description", prompt) if extra_item else prompt

            # create a meaningful prompt for AI
            prompt = (
                f"Enhance the following '{title}' section for a CV. "
                f"Consider the applicant is targeting the position '{target_job_title or job_title}' "
                f"at '{organization}'.\n\n"
                f"Original text:\n{desc}"
            )

        # استدعاء الدالة المحسنة
        prompt_text = build_enhancement_prompt(
            prompt=prompt,
            field_type=field_type,
            language=language,
            job_title=job_title,
            job_info=job_info,
            target_job_title=target_job_title,
            organization=organization,
            start_date=start_date,
            end_date=end_date,
            extra_item=extra_item  
                        )
        
        print(f"[ENHANCE] Generated Prompt: {prompt_text[:200]}...")
        
        result = call_deepseek_api(
            prompt_text, 
            language, 
            is_auto_fill=not bool(prompt),
            field_type=field_type,
            job_title=job_title,
            job_info=job_info,
            organization=organization,
            start_date=start_date,
            end_date=end_date,
            target_job_title=target_job_title
        )
        
        return jsonify({
            "success": True, 
            "language": language, 
            "field_type": field_type, 
            "is_auto_fill": not bool(prompt),
            "enhanced_text": result.get("enhanced_text", ""), 
            "suggestions": result.get("suggestions", {})
        })
        
    except Exception as e:
        import traceback
        print("[ERROR] /enhance failed:", e)
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/enhance_field", methods=["POST"])
def enhance_field_alias():
    return enhance_field()

@app.route("/available_templates")
def available_templates():
    return jsonify({"templates": ["modern", "professional", "classic"]})

@app.route('/upload_photo', methods=['POST'])
def upload_photo():
    try:
        if 'photo' not in request.files:
            return jsonify({'success': False, 'error': 'No photo file'}), 400
            
        photo_file = request.files['photo']
        if photo_file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400
            
        filename = f'photo_{datetime.now().strftime("%Y%m%d_%H%M%S")}_{photo_file.filename}'
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        photo_file.save(filepath)
        
        return jsonify({
            'success': True, 
            'photo_path': f'/static/uploads/{filename}', 
            'photo_url': f'/static/uploads/{filename}', 
            'filename': filename
        })
        
    except Exception as e:
        print(f'[ERROR] Photo upload failed: {e}')
        return jsonify({'success': False, 'error': str(e)}), 500

# === PDF Generation Routes ===
@app.route('/generate_pdf', methods=['POST'])
def generate_pdf_route():
    try:
        data = request.get_json(force=True)
        print(f"[PDF] Received data keys: {list(data.keys())}")
        
        language = data.get('language', 'en')
        template = data.get('template', 'modern')

        # Get organization safely
        organization = data.get("organization", "").strip()
        if organization:
            if 'personal_info' not in data or data['personal_info'] is None:
                data['personal_info'] = {}
            data['personal_info']['organization'] = organization

        # Ensure required fields exist with proper structure
        required_sections = {
            'personal_info': {},
            'experience': [],
            'education': [],
            'skills': '',
            'extra': []
        }
        
        for section, default_value in required_sections.items():
            if section not in data or data[section] is None:
                data[section] = default_value

        # Make sure lists are actually lists of dicts (same as preview)
        for section in ['experience', 'education', 'extra']:
            items = data.get(section, [])
            if not isinstance(items, list):
                items = []
            clean_items = []
            for item in items:
                if isinstance(item, dict):
                    clean_items.append(item)
                else:
                    clean_items.append({"description": str(item)})
            data[section] = clean_items

        # Ensure personal_info is a dict
        if not isinstance(data.get('personal_info'), dict):
            data['personal_info'] = {}

        # Process photo path - FIX: Ensure photo path is properly formatted
        photo_path = data.get('personal_info', {}).get('photo_path', '')
        if photo_path:
            # Ensure the photo path is properly formatted
            if not photo_path.startswith('/static/uploads/'):
                data['personal_info']['photo_path'] = f'/static/uploads/{os.path.basename(photo_path)}'
            print(f"[PDF] Photo path processed: {data['personal_info']['photo_path']}")
        else:
            print("[PDF] No photo path found in data")

        # Debug logs
        print(f"[PDF] Language: {language}, Template: {template}")
        print(f"[PDF] Personal info keys: {list(data.get('personal_info', {}).keys())}")
        print(f"[PDF] Photo path in final data: {data.get('personal_info', {}).get('photo_path', 'None')}")
        print(f"[PDF] Experience count: {len(data.get('experience', []))}")
        print(f"[PDF] Education count: {len(data.get('education', []))}")

        # Truncate fields safely
        data = truncate_fields(data)

        # Generate PDF
        pdf_path = generate_pdf(data, language, template)
        if not pdf_path:
            raise RuntimeError('PDF generation returned no path')

        return jsonify({
            'success': True,
            'pdf_url': f'/download_pdf/{os.path.basename(pdf_path)}',
            'template_used': template,
            'language_used': language
        })

    except Exception as e:
        import traceback
        print(f'[ERROR] PDF generation failed: {e}')
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)})
@app.route('/download_pdf/<filename>')
def download_pdf(filename):
    try:
        pdf_path = os.path.join('generated_cvs', filename)
        if not os.path.exists(pdf_path):
            return jsonify({'success': False, 'error': 'File not found'}), 404
        return send_file(pdf_path, as_attachment=True, download_name=filename)
    except Exception as e:
        print('[ERROR] PDF download failed:', e)
        return jsonify({'success': False, 'error': str(e)}), 500

# === Routes to prevent 404s ===
@app.route('/prepare_cv_for_pdf', methods=['POST'])
def prepare_cv_for_pdf():
    try:
        data = request.get_json(force=True)
        cv_data = data.get('cv_data', {})
        cv_data = truncate_fields(cv_data)
        return jsonify({'success': True, 'cleaned_data': cv_data, 'message': 'CV prepared for PDF'})
    except Exception as e:
        print('[ERROR] /prepare_cv_for_pdf failed:', e)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/validate_dates', methods=['POST'])
def validate_dates():
    """Validate date ranges for experience and education"""
    try:
        data = request.get_json(force=True)
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        
        if not start_date:
            return jsonify({'valid': True, 'message': ''})
            
        start_obj = datetime.strptime(start_date, '%Y-%m')
        end_obj = datetime.strptime(end_date, '%Y-%m') if end_date and end_date.lower() != 'present' else datetime.now()
        
        if end_obj < start_obj:
            return jsonify({
                'valid': False, 
                'message': 'End date cannot be before start date'
            })
        
        return jsonify({'valid': True, 'message': ''})
        
    except Exception as e:
        print(f'[ERROR] Date validation failed: {e}')
        return jsonify({'valid': True, 'message': ''})  # Fail silently for UX

@app.route('/preview', methods=['POST'])
def preview():
    try:
        cv_data = request.get_json(force=True)
        print(f"[PREVIEW] Received data: {list(cv_data.keys())}")

        # Get organization first and remove it from cv_data to avoid duplication
        organization = cv_data.get("organization", "").strip()
        # Remove organization from cv_data to prevent duplicate parameter
        if "organization" in cv_data:
            del cv_data["organization"]

        language = cv_data.get('language', 'en')
        template = cv_data.get('template', 'modern')

        # Ensure required sections exist
        required_sections = {
            'personal_info': {},
            'experience': [],
            'education': [],
            'skills': '',
            'extra': []
        }
        for section, default_value in required_sections.items():
            if section not in cv_data or cv_data[section] is None:
                cv_data[section] = default_value

        # Make sure lists are actually lists of dicts
        for section in ['experience', 'education', 'extra']:
            items = cv_data.get(section, [])
            if not isinstance(items, list):
                items = []
            clean_items = []
            for item in items:
                if isinstance(item, dict):
                    clean_items.append(item)
                else:
                    # Convert string or other types to dict
                    clean_items.append({"description": str(item)})
            cv_data[section] = clean_items

        # Ensure personal_info is a dict
        if not isinstance(cv_data.get('personal_info'), dict):
            cv_data['personal_info'] = {}

        # Add organization to personal_info for template access
        if 'personal_info' in cv_data:
            cv_data['personal_info']['organization'] = organization

        # Debug logs
        print(f"[PREVIEW] Personal info keys: {list(cv_data.get('personal_info', {}).keys())}")
        print(f"[PREVIEW] Experience count: {len(cv_data.get('experience', []))}")
        print(f"[PREVIEW] Education count: {len(cv_data.get('education', []))}")
        print(f"[PREVIEW] Skills: {cv_data.get('skills', '')}")
        print(f"[PREVIEW] Extra count: {len(cv_data.get('extra', []))}")
        print(f"[PREVIEW] Organization: {organization}")

        # Process photo path
        photo_path = cv_data.get('personal_info', {}).get('photo_path', '')
        if photo_path and not photo_path.startswith('/static/uploads/'):
            cv_data['personal_info']['photo_path'] = f'/static/uploads/{os.path.basename(photo_path)}'

        # Truncate long text safely
        cv_data = truncate_fields(cv_data)

        # Determine template file
        template_file = f'cv_template_{language}_{template}.html'
        print(f"[PREVIEW] Attempting to load template: {template_file}")

        try:
            # Pass cv_data without separate organization parameter
            html_content = render_template(template_file, **cv_data)
            print(f"[PREVIEW] Template rendered successfully: {template_file}")
        except Exception as e:
            print(f"[PREVIEW] Template error: {e}, using default modern template")
            template_file = f'cv_template_{language}_modern.html'
            try:
                html_content = render_template(template_file, **cv_data)
                print(f"[PREVIEW] Fallback template rendered: {template_file}")
            except Exception as fallback_error:
                print(f"[PREVIEW] Fallback template also failed: {fallback_error}")
                html_content = create_basic_preview(cv_data, language)
                template = 'basic'

        return jsonify({
            'success': True,
            'html_content': html_content,
            'language': language,
            'template': template
        })

    except Exception as e:
        print(f'[ERROR] /preview failed: {e}')
        import traceback
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'html_content': '<div class="alert alert-danger">Error generating preview</div>'
        }), 500

# === Debug Route for API Status ===
@app.route("/debug/api-status")
def debug_api_status():
    """Debug endpoint to check API connectivity"""
    import socket
    
    status = {
        "api_key_loaded": bool(DEEPSEEK_API_KEY),
        "api_key_preview": DEEPSEEK_API_KEY[:8] + "..." if DEEPSEEK_API_KEY else "None",
        "endpoints": API_ENDPOINTS
    }
    
    # Test DNS resolution
    for endpoint in API_ENDPOINTS:
        try:
            host = endpoint.split("//")[1].split("/")[0]
            ip = socket.gethostbyname(host)
            status[f"dns_{host}"] = f" Resolves to {ip}"
        except Exception as e:
            status[f"dns_{host}"] = f" Failed: {e}"
    
    return jsonify(status)

# === Health Check ===
@app.route("/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "api_configured": bool(DEEPSEEK_API_KEY)
    })

# === Start Flask ===
if __name__ == "__main__":
    print(" Starting CV Builder Flask App...")
    print("=" * 50)
    
    if DEEPSEEK_API_KEY:
        print(f" API Key Loaded: {DEEPSEEK_API_KEY[:10]}... (OpenRouter)")
    else:
        print(" No API key found in .env file. Please set DEEPSEEK_API_KEY")
        
    print(f" Multiple endpoints configured: {len(API_ENDPOINTS)}")
    print(f" Upload folder: {app.config['UPLOAD_FOLDER']}")
    print(f" Generated CVs folder: generated_cvs")
    print("=" * 50)
    print(" Available templates:")
    print("   - English: modern, professional, classic")
    print("   - Arabic: modern, professional, classic") 
    print("=" * 50)
    print(" Debug info available at: http://localhost:5000/debug/api-status")
    print(" Health check at: http://localhost:5000/health")
    print("=" * 50)
    
    app.run(host="0.0.0.0", port=5000, debug=True)