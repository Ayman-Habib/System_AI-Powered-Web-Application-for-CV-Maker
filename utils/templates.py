from reportlab.platypus import Paragraph, Spacer

def build_modern_design(story, personal_info, experiences, education, skills, extra, styles, is_arabic, language):
    story.append(Paragraph(personal_info.get("name", ""), styles["title"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(personal_info.get("summary", ""), styles["body"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Skills: {skills}", styles["body"]))
    story.append(Spacer(1, 12))

def draw_modern_design(canvas, doc, personal_info, styles):
    pass  # You can add header/footer design later

def build_professional_design(*args, **kwargs):
    build_modern_design(*args, **kwargs)

def draw_professional_design(*args, **kwargs):
    pass

def build_classic_design(*args, **kwargs):
    build_modern_design(*args, **kwargs)

def draw_classic_design(*args, **kwargs):
    pass
