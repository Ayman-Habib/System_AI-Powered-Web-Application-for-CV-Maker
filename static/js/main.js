class CVGenerator {
    constructor() {
        this.currentLanguage = 'en';
        this.experienceCount = 1;
        this.educationCount = 1;
        this.extraCount = 1;
        this.userId = 'user_' + Date.now();
        this.improvementCount = 0;
        this.currentStyleLevel = 1;
        this.selectedTemplate = 'modern';
        this.photoPath = '';
        this.availableTemplates = [];
        this.enhancedFields = new Set();
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateLanguage();
        this.loadAvailableTemplates();
        this.setupEnhancementButtons();
        this.setupValidation();
    }
    createEnhanceButton(fieldType) {
    return $(`
        <button type="button" class="btn btn-outline-primary ai-enhance" 
                data-field="${fieldType}" 
                title="${this.currentLanguage === 'ar' ? 'تحسين بالنظام الذكي' : 'Enhance with AI'}">
            <i class="fas fa-magic me-1"></i>
            ${this.currentLanguage === 'ar' ? 'تحسين' : 'Enhance'}
        </button>
    `);
}

    bindEvents() {
       
        $('#languageToggle').on('change', () => this.toggleLanguage());
        $(document).on('click', '.ai-enhance', (e) => this.enhanceWithAI(e));
        $('#addExperience').on('click', () => this.addExperienceField());
        $('#addEducation').on('click', () => this.addEducationField());
        $('#addExtra').on('click', () => this.addExtraField());
        $('#previewBtn').on('click', () => this.previewCV());
        $('#generatePdfBtn').on('click', () => this.generatePDF());
        $('#generateFromPreview').on('click', () => this.generatePDFFromPreview());
        $('#profilePhoto').on('change', (e) => this.handlePhotoUpload(e));
        
        // Template selection events
        $(document).on('click', '.select-template', (e) => this.selectTemplate(e));
        $(document).on('click', '.preview-template', (e) => this.previewTemplate(e));
        
        this.bindRemoveButtons();
    }

    // ========== Validation System ==========
    setupValidation() {
        this.setupRealTimeValidation();
        this.setupDateValidation();
    }

    setupRealTimeValidation() {
        $(document).on('blur', 'input, textarea', (e) => {
            this.validateField($(e.target));
        });

        $(document).on('change', '.experience-date, .education-date, .experience-current, .education-current', (e) => {
            const $container = $(e.target).closest('.experience-item, .education-item');
            this.validateDates($container);
        });

        $(document).on('input', '[data-field-type="name"]', (e) => {
            this.sanitizeNameField($(e.target));
        });
    }

    setupDateValidation() {
        $(document).on('change', '[name*="start_date"], [name*="end_date"]', (e) => {
            const $field = $(e.target);
            const $container = $field.closest('.experience-item, .education-item');
            if ($container.length) {
                this.validateDates($container);
            }
        });

        $(document).on('change', '.experience-current, .education-current', (e) => {
            const $checkbox = $(e.target);
            const $container = $checkbox.closest('.experience-item, .education-item');
            const $endDate = $container.find('[name*="end_date"]');
            
            if ($checkbox.is(':checked')) {
                $endDate.val('').prop('disabled', true);
            } else {
                $endDate.prop('disabled', false);
            }
            this.validateDates($container);
        });
    }

    async validateField($field) {
        const value = $field.val().trim();
        const fieldType = $field.data('field-type');
        const isRequired = $field.prop('required');
        
        $field.removeClass('is-invalid is-valid');
        $field.next('.invalid-feedback').hide();

        if (isRequired && !value) {
            this.showFieldError($field, 'required');
            return false;
        }

        if (!value && !isRequired) {
            return true;
        }

        let isValid = true;
        switch(fieldType) {
            case 'name':
                isValid = this.isValidName(value);
                if (!isValid) this.showFieldError($field, 'invalid_name');
                break;
                
            case 'email':
                isValid = this.isValidEmail(value);
                if (!isValid) this.showFieldError($field, 'invalid_email');
                break;
                
            case 'phone':
                isValid = this.isValidPhone(value);
                if (!isValid) this.showFieldError($field, 'invalid_phone');
                break;
                
            case 'job_title':
            case 'experience_title':
            case 'degree':
            case 'institution':
            case 'location':
            case 'extra_title':
                isValid = value.length <= 100;
                if (!isValid) this.showFieldError($field, 'too_long');
                break;
                
            case 'summary':
                isValid = value.length <= 2000;
                if (!isValid) this.showFieldError($field, 'too_long');
                break;
                
            case 'experience_description':
                isValid = value.length <= 2000;
                if (!isValid) this.showFieldError($field, 'too_long');
                break;
                
            case 'education_description':
            case 'extra_description':
                isValid = value.length <= 2000;
                if (!isValid) this.showFieldError($field, 'too_long');
                break;
                
            case 'skills':
                isValid = value.length <= 2000;
                if (!isValid) this.showFieldError($field, 'too_long');
                break;
        }

        if (isValid && value) {
            $field.addClass('is-valid');
        }

        return isValid;
    }

    showFieldError($field, errorType) {
        $field.addClass('is-invalid');
        
        const errorMessages = {
            'required': {
                en: 'This field is required',
                ar: 'هذا الحقل مطلوب'
            },
            'invalid_name': {
                en: 'Please enter a valid name (letters and spaces only)',
                ar: 'يرجى إدخال اسم صحيح (أحرف ومسافات فقط)'
            },
            'invalid_email': {
                en: 'Please enter a valid email address',
                ar: 'يرجى إدخال بريد إلكتروني صحيح'
            },
            'invalid_phone': {
                en: 'Please enter a valid phone number',
                ar: 'يرجى إدخال رقم هاتف صحيح'
            },
            'too_long': {
                en: 'Text is too long',
                ar: 'النص طويل جداً'
            }
        };

        const message = errorMessages[errorType]?.[this.currentLanguage] || errorMessages[errorType]?.en || 'Invalid field';
        
        let $feedback = $field.next('.invalid-feedback');
        if (!$feedback.length) {
            $feedback = $('<div class="invalid-feedback"></div>');
            $field.after($feedback);
        }
        $feedback.text(message).show();
    }

    sanitizeNameField($field) {
        let value = $field.val();
        const sanitized = value.replace(/[^a-zA-Z\u0600-\u06FF\s\-\.]/g, '');
        if (value !== sanitized) {
            $field.val(sanitized);
        }
    }

    isValidName(name) {
        const nameRegex = /^[a-zA-Z\u0600-\u06FF\s\-\.]{2,50}$/;
        return nameRegex.test(name);
    }

    isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^[\+\d\s\-\(\)]{10,20}$/;
        return phoneRegex.test(phone);
    }

    async validateDates($container) {
        const startDate = $container.find('[data-field-type="start_date"]').val();
        const endDate = $container.find('[data-field-type="end_date"]').val();
        const isCurrent = $container.find('.experience-current, .education-current').is(':checked');
        const fieldType = $container.hasClass('experience-item') ? 'experience' : 'education';
        
        const $message = $container.find('.date-validation-message');
        $message.hide().removeClass('text-danger text-success');

        try {
            const response = await fetch('/validate_dates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: startDate,
                    end_date: endDate,
                    is_current: isCurrent,
                    field_type: fieldType,
                    language: this.currentLanguage
                })
            });

            const data = await response.json();
            
            if (!data.valid) {
                $message.text(data.message).addClass('text-danger').show();
                $container.find('[data-field-type="start_date"], [data-field-type="end_date"]').addClass('is-invalid');
                return false;
            } else {
                $message.text(data.message || '').addClass('text-success');
                if (data.message) $message.show();
                
                $container.find('[data-field-type="start_date"], [data-field-type="end_date"]').removeClass('is-invalid').addClass('is-valid');
                
                if (data.corrected_dates) {
                    if (data.corrected_dates.start_date) {
                        $container.find('[data-field-type="start_date"]').val(data.corrected_dates.start_date);
                    }
                    if (data.corrected_dates.end_date) {
                        $container.find('[data-field-type="end_date"]').val(data.corrected_dates.end_date);
                    }
                }
                return true;
            }
        } catch (error) {
            console.error('Date validation error:', error);
            return true;
        }
    }

    async validateForm() {
        let isValid = true;
        const errors = [];

        this.hideValidationSummary();

        const requiredFields = $('[required]');
        requiredFields.each((index, field) => {
            const $field = $(field);
            if (!$field.val().trim()) {
                isValid = false;
                this.showFieldError($field, 'required');
                errors.push({
                    field: $field.attr('name'),
                    message: this.currentLanguage === 'ar' ? 'حقل مطلوب' : 'Required field'
                });
            }
        });

        const textFields = $('input[type="text"], input[type="email"], input[type="tel"], textarea');
        for (const field of textFields) {
            const $field = $(field);
            const fieldValid = await this.validateField($field);
            if (!fieldValid && $field.val().trim()) {
                isValid = false;
                errors.push({
                    field: $field.attr('name'),
                    message: this.currentLanguage === 'ar' ? 'قيمة غير صالحة' : 'Invalid value'
                });
            }
        }

        const dateContainers = $('.experience-item, .education-item');
        for (const container of dateContainers) {
            const $container = $(container);
            const dateValid = await this.validateDates($container);
            if (!dateValid) {
                isValid = false;
                errors.push({
                    field: 'dates',
                    message: this.currentLanguage === 'ar' ? 'تواريخ غير صالحة' : 'Invalid dates'
                });
            }
        }

        const personalInfo = this.getFormData().personal_info;
        if (!personalInfo.name || !personalInfo.email) {
            isValid = false;
            errors.push({
                field: 'basic_info',
                message: this.currentLanguage === 'ar' ? 'الاسم والبريد الإلكتروني مطلوبان' : 'Name and email are required'
            });
        }

        if (!isValid) {
            this.showValidationSummary(errors);
        }

        return isValid;
    }

    showValidationSummary(errors) {
        const $summary = $('#validationSummary');
        const $message = $('#validationMessage');
        
        let messageText = '';
        if (this.currentLanguage === 'ar') {
            messageText = `يوجد ${errors.length} أخطاء تحتاج إلى التصحيح:`;
            errors.forEach((error, index) => {
                messageText += `<br>• ${error.message}`;
            });
        } else {
            messageText = `There are ${errors.length} errors that need to be fixed:`;
            errors.forEach((error, index) => {
                messageText += `<br>• ${error.message}`;
            });
        }
        
        $message.html(messageText);
        $summary.show();

        $('html, body').animate({
            scrollTop: $summary.offset().top - 100
        }, 500);
    }

    hideValidationSummary() {
        $('#validationSummary').hide();
    }

    // ========== Enhancement System ==========
    setupEnhancementButtons() {
        this.addEnhancementButtonsToExistingFields();
    }

    addEnhancementButtonsToExistingFields() {
        const enhancementFields = [
            { selector: 'input[name="personal_info[summary]"]', field: 'summary' },
            { selector: 'textarea[name="personal_info[summary]"]', field: 'summary' },
            { selector: 'input[name="skills"]', field: 'skills' },
            { selector: 'input[name="personal_info[job_title]"]', field: 'job_title' }
        ];

        enhancementFields.forEach(({ selector, field }) => {
            const $input = $(selector);
            if ($input.length && !$input.closest('.input-group').find('.ai-enhance').length) {
                this.wrapWithEnhancementButton($input, field);
            }
        });
    }

    wrapWithEnhancementButton($input, fieldType) {
        const isTextarea = $input.is('textarea');
        const wrapperClass = isTextarea ? 'enhance-textarea-wrapper' : 'enhance-input-wrapper';
        
        $input.wrap(`<div class="input-group ${wrapperClass}"></div>`);
        const enhanceButton =this.createEnhanceButton(fieldType); 
        $input.after(enhanceButton);
    }

    // ========== Language & Template System ==========
    toggleLanguage() {
        this.currentLanguage = $('#languageToggle').is(':checked') ? 'ar' : 'en';
        $('#language').val(this.currentLanguage);
        this.updateLanguage();
        this.renderTemplates();
    }

    updateLanguage() {
        const isRTL = this.currentLanguage === 'ar';
        $('html').attr('dir', isRTL ? 'rtl' : 'ltr');
        $('body').attr('lang', this.currentLanguage);
        $('#languageLabel').text(isRTL ? 'العربية' : 'English');

        $('[data-en]').each((index, element) => {
            const $el = $(element);
            const text = isRTL ? $el.attr('data-ar') : $el.attr('data-en');
            if (text) $el.text(text);
        });

        this.showStyleLevel();
        this.updateEnhancementButtons();
        this.updateValidationMessages();
    }

    updateValidationMessages() {
        $('.invalid-feedback').each((index, element) => {
            const $element = $(element);
        });
    }

    updateEnhancementButtons() {
        $('.ai-enhance').attr('title', 
            this.currentLanguage === 'ar' ? 'تحسين بالنظام الذكي' : 'Enhance with AI'
        );
    }

    async loadAvailableTemplates() {
        try {
            const response = await fetch('/available_templates');
            const data = await response.json();
            
            if (data.success) {
                this.availableTemplates = data.templates;
                this.renderTemplates();
            } else {
                console.error('Failed to load templates');
                this.loadDefaultTemplates();
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.loadDefaultTemplates();
        }
    }

    loadDefaultTemplates() {
        this.availableTemplates = [
            {
                id: 'modern',
                name: {
                    'en': 'Modern Design',
                    'ar': 'التصميم العصري'
                },
                description: {
                    'en': 'Contemporary design with gradient colors and modern layout',
                    'ar': 'تصميم معاصر بألوان متدرجة وتخطيط عصري'
                },
                features: {
                    'en': ['Gradient colors', 'Circular photo', 'Modern typography'],
                    'ar': ['ألوان متدرجة', 'صورة دائرية', 'خطوط عصرية']
                },
                color: '#ff6b6b'
            },
            {
                id: 'professional',
                name: {
                    'en': 'Professional Design', 
                    'ar': 'التصميم الاحترافي'
                },
                description: {
                    'en': 'Structured and formal design suitable for corporate environments',
                    'ar': 'تصميم منظم ورسمي مناسب للبيئات المؤسسية'
                },
                features: {
                    'en': ['Structured layout', 'Professional typography', 'Clean sections'],
                    'ar': ['تخطيط منظم', 'خطوط احترافية', 'أقسام نظيفة']
                },
                color: '#667eea'
            },
            {
                id: 'classic',
                name: {
                    'en': 'Classic Design',
                    'ar': 'التصميم الكلاسيكي'
                },
                description: {
                    'en': 'Traditional and simple design for formal applications',
                    'ar': 'تصميم تقليدي وبسيط للمتقدمات الرسمية'
                },
                features: {
                    'en': ['Simple layout', 'Traditional typography', 'Formal style'],
                    'ar': ['تخطيط بسيط', 'خطوط تقليدية', 'نمط رسمي']
                },
                color: '#2c3e50'
            }
        ];
        this.renderTemplates();
    }

    renderTemplates() {
        const container = $('#templateSelection');
        container.empty();

        this.availableTemplates.forEach(template => {
            const isSelected = template.id === this.selectedTemplate;
            const templateName = template.name[this.currentLanguage] || template.name['en'];
            const templateDesc = template.description[this.currentLanguage] || template.description['en'];
            const templateFeatures = template.features[this.currentLanguage] || template.features['en'];

            const templateHtml = `
                <div class="col-md-4 mb-4">
                    <div class="template-card card h-100 ${isSelected ? 'border-primary selected' : 'border-light'}" 
                         data-template="${template.id}">
                        <div class="card-body">
                            <div class="template-preview mb-3 text-center" 
                                 style="height: 120px; background: linear-gradient(135deg, ${template.color || '#007bff'}, ${this.lightenColor(template.color || '#007bff', 30)}); 
                                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                                        transition: all 0.3s ease; border: 3px solid ${isSelected ? template.color || '#007bff' : 'transparent'};">
                                <div class="template-preview-content text-white">
                                    <i class="fas fa-file-alt fa-3x mb-2"></i>
                                    <div class="template-name-preview" style="font-size: 12px; font-weight: bold;">${templateName}</div>
                                </div>
                            </div>
                            <h6 class="template-name mb-2">${templateName}</h6>
                            <p class="template-desc small text-muted mb-2">${templateDesc}</p>
                            <div class="template-features mb-3">
                                ${templateFeatures.map(feature => `<span class="badge bg-light text-dark me-1 mb-1">${feature}</span>`).join('')}
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-primary'} select-template flex-fill" 
                                        data-template="${template.id}">
                                    <i class="fas fa-check me-1"></i>
                                    ${this.currentLanguage === 'ar' ? 'اختر' : 'Select'}
                                </button>
                                <button class="btn btn-sm btn-outline-secondary preview-template" 
                                        data-template="${template.id}"
                                        title="${this.currentLanguage === 'ar' ? 'معاينة القالب' : 'Preview Template'}">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.append(templateHtml);
        });

        this.showStyleLevel();
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }

    selectTemplate(event) {
        const templateId = $(event.currentTarget).data('template');
        this.selectedTemplate = templateId;
        
        this.updateTemplateDisplay();
        $('#selectedTemplate').val(templateId);
        this.showStyleLevel();
        
        console.log('Template selected:', templateId);
        this.showToast(
            this.currentLanguage === 'ar' ? 
            `تم اختيار القالب: ${this.getTemplateName(templateId)}` :
            `Template selected: ${this.getTemplateName(templateId, 'en')}`,
            'success'
        );
    }

    updateTemplateDisplay() {
        $('.template-card').removeClass('border-primary selected').addClass('border-light');
        $(`.template-card[data-template="${this.selectedTemplate}"]`).removeClass('border-light').addClass('border-primary selected');
        
        $('.select-template').removeClass('btn-primary').addClass('btn-outline-primary');
        $(`.select-template[data-template="${this.selectedTemplate}"]`).removeClass('btn-outline-primary').addClass('btn-primary');
        
        $('.template-preview').css('border-color', 'transparent');
        $(`.template-card[data-template="${this.selectedTemplate}"] .template-preview`).css('border-color', this.getTemplateColor(this.selectedTemplate));
    }

    getTemplateName(templateId, language = null) {
        const lang = language || this.currentLanguage;
        const template = this.availableTemplates.find(t => t.id === templateId);
        return template ? (template.name[lang] || template.name['en']) : templateId;
    }

    getTemplateColor(templateId) {
        const template = this.availableTemplates.find(t => t.id === templateId);
        return template ? template.color : '#007bff';
    }

    // ========== Form Fields Management ==========
    bindRemoveButtons() {
        $('.remove-field').off('click').on('click', function() {
            $(this).closest('.experience-item, .education-item, .extra-item').remove();
        });
    }

    addExperienceField() {
        const idx = this.experienceCount++;
        const jobTitleLabel = this.currentLanguage === 'ar' ? 'المسمى الوظيفي' : 'Job Title';
        const companyLabel = this.currentLanguage === 'ar' ? 'الشركة' : 'Company';
        const startDateLabel = this.currentLanguage === 'ar' ? 'تاريخ البدء' : 'Start Date';
        const endDateLabel = this.currentLanguage === 'ar' ? 'تاريخ الانتهاء' : 'End Date';
        const descriptionLabel = this.currentLanguage === 'ar' ? 'الوصف' : 'Description';
        const removeLabel = this.currentLanguage === 'ar' ? 'حذف' : 'Remove';
        const currentLabel = this.currentLanguage === 'ar' ? 'حالياً' : 'Current';

        const html = `
            <div class="experience-item mb-3 border-top pt-3">
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <label class="form-label">${jobTitleLabel}</label>
                        <div class="input-group">
                            <input type="text" class="form-control" name="experience[${idx}][title]" placeholder="${jobTitleLabel}">
                                <button type="button" class="btn btn-outline-primary ai-enhance" data-field="experience_title" title="${this.currentLanguage === 'ar' ? 'تحسين بالنظام الذكي' : 'Enhance with AI'}">
                                <i class="fas fa-wand-magic-sparkles"></i>
                            </button>
                        </div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <label class="form-label">${companyLabel}</label>
                        <input type="text" class="form-control" name="experience[${idx}][company]" placeholder="${companyLabel}">
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-3 mb-2">
                        <label class="form-label">${startDateLabel}</label>
                        <input type="month" class="form-control" name="experience[${idx}][start_date]">
                    </div>
                    <div class="col-md-3 mb-2">
                        <label class="form-label">${endDateLabel}</label>
                        <input type="month" class="form-control" name="experience[${idx}][end_date]">
                    </div>
                    <div class="col-md-6 mb-2 d-flex align-items-end">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" name="experience[${idx}][current]" id="exp_current_${idx}">
                            <label class="form-check-label" for="exp_current_${idx}">
                                ${currentLabel}
                            </label>
                        </div>
                    </div>
                </div>
                <div class="mb-2">
                    <label class="form-label">${descriptionLabel}</label>
                    <div class="input-group">
                        <textarea class="form-control" rows="3" name="experience[${idx}][description]" placeholder="${descriptionLabel}"></textarea>
                       <button type="button" class="btn btn-outline-primary ai-enhance" data-field="experience" title="${this.currentLanguage === 'ar' ? 'تحسين بالنظام الذكي' : 'Enhance with AI'}">
                            <i class="fas fa-wand-magic-sparkles"></i>
                        </button>
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                    <i class="fas fa-trash me-1"></i>${removeLabel}
                </button>
            </div>
        `;
        $('#experienceFields').append(html);
        this.bindRemoveButtons();
    }

    addEducationField() {
        const idx = this.educationCount++;
        const degreeLabel = this.currentLanguage === 'ar' ? 'الدرجة العلمية' : 'Degree';
        const institutionLabel = this.currentLanguage === 'ar' ? 'المؤسسة' : 'Institution';
        const descriptionLabel = this.currentLanguage === 'ar' ? 'الوصف' : 'Description';
        const removeLabel = this.currentLanguage === 'ar' ? 'حذف' : 'Remove';

        const html = `
            <div class="education-item mb-3 border-top pt-3">
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <label class="form-label">${degreeLabel}</label>
                        <input type="text" class="form-control" name="education[${idx}][degree]" placeholder="${degreeLabel}">
                    </div>
                    <div class="col-md-6 mb-2">
                        <label class="form-label">${institutionLabel}</label>
                        <input type="text" class="form-control" name="education[${idx}][institution]" placeholder="${institutionLabel}">
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-2">
                        <label class="form-label">${this.currentLanguage === 'ar' ? 'تاريخ البدء' : 'Start Date'}</label>
                        <input type="month" class="form-control" name="education[${idx}][start_date]">
                    </div>
                    <div class="col-md-6 mb-2">
                        <label class="form-label">${this.currentLanguage === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</label>
                        <input type="month" class="form-control" name="education[${idx}][end_date]">
                    </div>
                </div>
                <div class="mb-2">
                    <label class="form-label">${descriptionLabel}</label>
                    <div class="input-group">
                        <textarea class="form-control" rows="2" name="education[${idx}][description]" placeholder="${descriptionLabel}"></textarea>
                        <button type="button" class="btn btn-outline-primary ai-enhance" data-field="education" title="${this.currentLanguage === 'ar' ? 'تحسين بالنظام الذكي' : 'Enhance with AI'}">
                            <i class="fas fa-wand-magic-sparkles"></i>
                        </button>
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                    <i class="fas fa-trash me-1"></i>${removeLabel}
                </button>
            </div>
        `;
        $('#educationFields').append(html);
        this.bindRemoveButtons();
    }

    addExtraField() {
        const idx = this.extraCount++;
        const titleLabel = this.currentLanguage === 'ar' ? 'العنوان' : 'Title';
        const descriptionLabel = this.currentLanguage === 'ar' ? 'الوصف' : 'Description';
        const removeLabel = this.currentLanguage === 'ar' ? 'حذف' : 'Remove';

        const html = `
            <div class="extra-item mb-3 border-top pt-3">
                <div class="mb-3">
                    <label class="form-label">${titleLabel}</label>
                    <input type="text" class="form-control" name="extra[${idx}][title]" placeholder="${titleLabel}">
                </div>
                <div class="mb-3">
                    <label class="form-label">${descriptionLabel}</label>
                    <div class="input-group">
                        <textarea class="form-control" rows="2" name="extra[${idx}][description]" placeholder="${descriptionLabel}"></textarea>
                       <button type="button" class="btn btn-outline-primary ai-enhance" data-field="extra" title="${this.currentLanguage === 'ar' ? 'تحسين بالنظام الذكي' : 'Enhance with AI'}">
                            <i class="fas fa-wand-magic-sparkles"></i>
                        </button
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                    <i class="fas fa-trash me-1"></i>${removeLabel}
                </button>
            </div>
        `;
        $('#extraFields').append(html);
        this.bindRemoveButtons();
    }

    // ========== AI Enhancement ==========
async enhanceWithAI(event) {
    const button = $(event.currentTarget);
    const inputGroup = button.closest('.input-group');
    const input = inputGroup.find('input, textarea').first();
    const field = button.data('field');
    const originalText = input.val() || '';
    const template = this.selectedTemplate;
    
    const jobTitle = $('input[name="personal_info[job_title]"]').val() || 
                    $('input[name="job_title"]').val() || 
                    'Professional';

    const isEmpty = !originalText.trim();

    const originalHtml = button.html();
    button.html('<div class="spinner-border spinner-border-sm me-1"></div>' + 
               (this.currentLanguage === 'ar' ? 'جاري التحسين...' : 'Enhancing...'));
    button.prop('disabled', true);

    try {
        const organization = $('#organization').val() || '';

        // FIX: detect experience context
        let experience_item = null;

        if (field === 'experience' || field === 'experience_description' || field === 'experience_title') {

            // IMPORTANT FIX: convert jQuery object to DOM element
            const exp = button.closest('.experience-item')[0];

            experience_item = {
                title: exp.querySelector('input[name*="[title]"]').value || "",
                company: exp.querySelector('input[name*="[company]"]').value || "",
                start_date: exp.querySelector('input[name*="[start_date]"]').value || "",
                end_date: exp.querySelector('input[name*="[end_date]"]').value || "",
                description: exp.querySelector('textarea[name*="[description]"]').value || ""
            };

            console.log(" Extracted experience_item:", experience_item);
        }
        else if (field === 'education' || field === 'education_description' || field === 'education_title') {

            // IMPORTANT: convert jQuery object to DOM element
            const edu = button.closest('.education-item')[0];

            var education_item = {
                degree: edu.querySelector('input[name*="[degree]"]')?.value || "",
                institution: edu.querySelector('input[name*="[institution]"]')?.value || "",
                start_date: edu.querySelector('input[name*="[start_date]"]')?.value || "",
                end_date: edu.querySelector('input[name*="[end_date]"]')?.value || "",
                description: edu.querySelector('textarea[name*="[description]"]')?.value || ""
            };

            console.log(" Extracted education_item:", education_item);

            // نرسلها إلى السيرفر عبر نفس الطلب
            var isEducation = true;
        }
                //  NEW: detect "Extra Information" context
        else if (field === 'extra' || field === 'extra_description' || field === 'extra_title') {

            const extra = button.closest('.extra-item')[0];

            var extra_item = {
                title: extra.querySelector('input[name*="[title]"]')?.value || "Additional Information",
                description: extra.querySelector('textarea[name*="[description]"]')?.value || ""
            };

            console.log(" Extracted extra_item:", extra_item);

            // We’ll reuse these values later in the fetch payload
            var isExtra = true;
        }


        const res = await fetch('/enhance_field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        text: originalText,
        field_type: field,
        language: this.currentLanguage,
        user_id: this.userId,
        template: template,

        experience_item: experience_item,

        //  Education support
        education_item:
            (field === 'education' ||
             field === 'education_description' ||
             field === 'education_title')
                ? (() => {
                    const edu = button.closest('.education-item')[0];
                    if (!edu) return null;
                    return {
                        degree: edu.querySelector('input[name*="[degree]"]')?.value || "",
                        institution: edu.querySelector('input[name*="[institution]"]')?.value || "",
                        start_date: edu.querySelector('input[name*="[start_date]"]')?.value || "",
                        end_date: edu.querySelector('input[name*="[end_date]"]')?.value || "",
                        description: edu.querySelector('textarea[name*="[description]"]')?.value || ""
                    };
                })()
                : null,

        //  Extra Information support
        extra_item:
            (field === 'extra' ||
             field === 'extra_description' ||
             field === 'extra_title')
                ? (() => {
                    const extra = button.closest('.extra-item')[0];
                    if (!extra) return null;
                    return {
                        title: extra.querySelector('input[name*="[title]"]')?.value || "Additional Information",
                        description: extra.querySelector('textarea[name*="[description]"]')?.value || ""
                    };
                })()
                : null,

        //  Smart title & info depending on field type
        job_title:
            (field === 'education' ||
             field === 'education_description' ||
             field === 'education_title')
                ? (() => {
                    const edu = button.closest('.education-item')[0];
                    return edu?.querySelector('input[name*="[degree]"]')?.value || jobTitle;
                })()
            : (field === 'extra' ||
               field === 'extra_description' ||
               field === 'extra_title')
                ? (() => {
                    const extra = button.closest('.extra-item')[0];
                    return extra?.querySelector('input[name*="[title]"]')?.value || jobTitle;
                })()
            : (experience_item ? experience_item.title : jobTitle),

        job_info:
            (field === 'education' ||
             field === 'education_description' ||
             field === 'education_title')
                ? (() => {
                    const edu = button.closest('.education-item')[0];
                    if (!edu) return jobTitle;
                    return {
                        degree: edu.querySelector('input[name*="[degree]"]')?.value || "",
                        institution: edu.querySelector('input[name*="[institution]"]')?.value || ""
                    };
                })()
            : (field === 'extra' ||
               field === 'extra_description' ||
               field === 'extra_title')
                ? (() => {
                    const extra = button.closest('.extra-item')[0];
                    if (!extra) return jobTitle;
                    return {
                        title: extra.querySelector('input[name*="[title]"]')?.value || "",
                        description: extra.querySelector('textarea[name*="[description]"]')?.value || ""
                    };
                })()
            : (experience_item ? experience_item.company : jobTitle),

        organization: organization,
        style_level: this.currentStyleLevel,
        enhancement_method: 'hybrid_smart'
    })
});




        const data = await res.json();
        
        if (data.enhanced_text) {
            input.val(data.enhanced_text);
            input.attr('data-enhanced', 'true');
            this.addEnhancementIndicator(inputGroup);
            
            this.showToast(
                this.currentLanguage === 'ar' ? 'تم التحسين بنجاح' : 'Successfully enhanced',
                'success'
            );
        } else {
            throw new Error('No enhanced text received');
        }

    } catch (err) {
        console.error('AI Enhancement error:', err);
        this.showToast(
            this.currentLanguage === 'ar' ? 'فشل في التحسين' : 'Enhancement failed', 
            'error'
        );
    } finally {
        button.html(originalHtml);
        button.prop('disabled', false);
    }
}


    addEnhancementIndicator(inputGroup) {
        if (!inputGroup.find('.enhancement-indicator').length) {
            const indicator = `
                <span class="enhancement-indicator text-success ms-2" 
                      title="${this.currentLanguage === 'ar' ? 'تم التحسين' : 'Enhanced'}">
                    <i class="fas fa-check-circle"></i>
                </span>
            `;
            inputGroup.append(indicator);
        }
    }

    showStyleLevel() {
        const levelText = this.currentLanguage === 'ar' 
            ? `مستوى الأسلوب: ${this.currentStyleLevel} (${this.getStyleDescription(this.currentStyleLevel, this.selectedTemplate)})`
            : `Style Level: ${this.currentStyleLevel} (${this.getStyleDescription(this.currentStyleLevel, this.selectedTemplate, 'en')})`;
        
        $('#styleLevelDisplay').text(levelText);
        
        const progressPercent = Math.min((this.currentStyleLevel / 5) * 100, 100);
        $('#styleProgressBar').css('width', `${progressPercent}%`);
        $('#styleProgressBar').attr('aria-valuenow', progressPercent);
    }

    getStyleDescription(level, template, language = 'ar') {
        const descriptions = {
            'modern': {
                'ar': ['مهني عصري', 'مبتكر', 'قائد', 'تقني متقدم', 'متميز'],
                'en': ['Modern Professional', 'Innovative', 'Leader', 'Advanced Technical', 'Distinguished']
            },
            'professional': {
                'ar': ['محترف', 'خبير', 'استشاري', 'مدير', 'تنفيذي'],
                'en': ['Professional', 'Expert', 'Consultant', 'Manager', 'Executive']
            },
            'classic': {
                'ar': ['تقليدي', 'رسمي', 'محترف', 'متمرس', 'متميز'],
                'en': ['Traditional', 'Formal', 'Professional', 'Experienced', 'Distinguished']
            }
        };
        
        const templateDesc = descriptions[template] || descriptions['modern'];
        const levelIndex = Math.min(level - 1, 4);
        
        return templateDesc[language][levelIndex] || templateDesc[language][0];
    }

    // ========== Data Management ==========
    getFormData() {
        const formData = { 
            language: this.currentLanguage, 
            personal_info: {}, 
            experience: [], 
            education: [], 
            skills: '', 
            extra: [], 
            template: this.selectedTemplate,
            user_id: this.userId,
            organization: $('#organization').val() || ''
        };

        // Personal Info
        $('input[name^="personal_info"], textarea[name^="personal_info"]').each(function() {
            const name = $(this).attr('name').replace('personal_info[', '').replace(']', '');
            formData.personal_info[name] = $(this).val();
        });

        //  FIX: Include photo path
        if (this.photoPath) {
            formData.personal_info.photo_path = this.photoPath;
            console.log(' Including photo path in form data:', this.photoPath);
        } else {
            console.log(' No photo path available');
        }

        // Experience
        $('.experience-item').each(function() {
            const experience = {
                title: $(this).find('input[name*="[title]"]').val(),
                company: $(this).find('input[name*="[company]"]').val(),
                start_date: $(this).find('input[name*="[start_date]"]').val(),
                end_date: $(this).find('input[name*="[end_date]"]').val(),
                description: $(this).find('textarea[name*="[description]"]').val(),
                current: $(this).find('input[name*="[current]"]').is(':checked')
            };
            if (experience.title || experience.company || experience.description) {
                formData.experience.push(experience);
            }
        });

        // Education
        $('.education-item').each(function() {
            const education = {
                degree: $(this).find('input[name*="[degree]"]').val(),
                institution: $(this).find('input[name*="[institution]"]').val(),
                start_date: $(this).find('input[name*="[start_date]"]').val(),
                end_date: $(this).find('input[name*="[end_date]"]').val(),
                description: $(this).find('textarea[name*="[description]"]').val()
            };
            if (education.degree || education.institution || education.description) {
                formData.education.push(education);
            }
        });

        // Skills
        formData.skills = $('input[name="skills"]').val();

        // Extra
        $('.extra-item').each(function() {
            const extra = {
                title: $(this).find('input[name*="[title]"]').val(),
                description: $(this).find('textarea[name*="[description]"]').val()
            };
            if (extra.title || extra.description) {
                formData.extra.push(extra);
            }
        });

        console.log(' Form data collected:', formData);
        return formData;
    }

    // ========== Preview & PDF Generation ==========
    async previewCV() {
        const isValid = await this.validateForm();
        if (!isValid) {
            this.showToast(
                this.currentLanguage === 'ar' ? 'يرجى تصحيح الأخطاء قبل المعاينة' : 'Please fix errors before preview',
                'warning'
            );
            return;
        }

        try {
            const formData = this.getFormData();
            console.log('Preview data:', formData);
            
            const response = await fetch('/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (data.success) {
                $('#previewContent').html(data.html_content);
                $('#previewModal').modal('show');
                this.tempData = formData;
                
                const previewTitle = this.currentLanguage === 'ar' ? 
                    `معاينة السيرة الذاتية - ${this.getTemplateName(this.selectedTemplate)}` :
                    `CV Preview - ${this.getTemplateName(this.selectedTemplate, 'en')}`;
                $('#previewModalLabel').text(previewTitle);
            } else {
                this.showToast(
                    this.currentLanguage === 'ar' ? 'فشل في المعاينة' : 'Preview failed', 
                    'error'
                );
            }
        } catch (error) {
            console.error('Preview error:', error);
            this.showToast(
                this.currentLanguage === 'ar' ? 'خطأ في المعاينة' : 'Preview error', 
                'error'
            );
        }
    }

    async generatePDF() {
        const isValid = await this.validateForm();
        if (!isValid) {
            this.showToast(
                this.currentLanguage === 'ar' ? 'يرجى تصحيح الأخطاء قبل إنشاء PDF' : 'Please fix errors before generating PDF',
                'warning'
            );
            return;
        }

        const formData = this.getFormData();
        
        formData.template = this.selectedTemplate;
        formData.language = this.currentLanguage;
        
        if (this.photoPath && !formData.personal_info.photo_path) {
            formData.personal_info.photo_path = this.photoPath;
            console.log(' Added photo path in generatePDF:', this.photoPath);
        }

        console.log(' Final data for PDF generation:', formData);
        
        await this.generatePDFWithData(formData);
    }

    async generatePDFFromPreview() {
        if (this.tempData) {
            await this.generatePDFWithData(this.tempData);
        } else {
            this.showToast(
                this.currentLanguage === 'ar' ? 'لا توجد بيانات للمعاينة' : 'No preview data available',
                'warning'
            );
        }
    }

    async generatePDFWithData(formData) {
        try {
            console.log(' Generating PDF with data:', formData);
            
            if (formData.personal_info.photo_path) {
                console.log(' Photo included:', formData.personal_info.photo_path);
            } else {
                console.log(' No photo included in data');
            }
            
            const response = await fetch('/generate_pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log(' PDF generation result:', data);
            
            if (data.success) {
                window.open(data.pdf_url, '_blank');
                this.showToast(
                    this.currentLanguage === 'ar' ? 
                    `تم إنشاء PDF بنجاح باستخدام قالب ${this.getTemplateName(this.selectedTemplate)}` :
                    `PDF generated successfully using ${this.getTemplateName(this.selectedTemplate, 'en')} template`,
                    'success'
                );
            } else {
                throw new Error(data.error || 'PDF generation failed');
            }
        } catch (error) {
            console.error(' PDF generation error:', error);
            this.showToast(
                this.currentLanguage === 'ar' ? 'فشل في إنشاء PDF' : 'PDF generation failed',
                'error'
            );
        }
    }

    // ========== Photo Upload ==========
    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            if (!file.type.match('image.*')) {
                this.showToast(
                    this.currentLanguage === 'ar' ? 'يرجى اختيار ملف صورة' : 'Please select an image file',
                    'error'
                );
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                this.showToast(
                    this.currentLanguage === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 5MB' : 'Image size must be less than 5MB',
                    'error'
                );
                return;
            }

            this.uploadPhoto(file);
        }
    }

    async uploadPhoto(file) {
        const formData = new FormData();
        formData.append('photo', file);

        this.showToast(
            this.currentLanguage === 'ar' ? 'جاري رفع الصورة...' : 'Uploading photo...',
            'info'
        );

        try {
            const response = await fetch('/upload_photo', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                this.photoPath = data.photo_path;
                $('#photoBase64').val(this.photoPath);
                
                this.showPhotoPreview(data.photo_url || data.photo_path);
                
                this.showToast(
                    this.currentLanguage === 'ar' ? 'تم رفع الصورة بنجاح' : 'Photo uploaded successfully',
                    'success'
                );
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Photo upload error:', error);
            this.showToast(
                this.currentLanguage === 'ar' ? 'فشل في رفع الصورة' : 'Photo upload failed',
                'error'
            );
        }
    }

    showPhotoPreview(photoUrl) {
        let previewContainer = $('#photoPreview');
        if (previewContainer.length === 0) {
            previewContainer = $('<div id="photoPreview" class="mt-2 text-center"></div>');
            $('#profilePhoto').after(previewContainer);
        }
        
        previewContainer.html(`
            <div class="photo-preview-container">
                <img src="${photoUrl}" alt="Preview" class="img-thumbnail" style="max-width: 150px; max-height: 150px;">
                <button type="button" class="btn btn-sm btn-outline-danger mt-1 remove-photo">
                    <i class="fas fa-times me-1"></i>${this.currentLanguage === 'ar' ? 'إزالة' : 'Remove'}
                </button>
            </div>
        `);
        
        $('.remove-photo').on('click', () => this.removePhoto());
    }

    removePhoto() {
        this.photoPath = '';
        $('#photoBase64').val('');
        $('#profilePhoto').val('');
        $('#photoPreview').remove();
        
        this.showToast(
            this.currentLanguage === 'ar' ? 'تم إزالة الصورة' : 'Photo removed',
            'info'
        );
    }

    // ========== UI Utilities ==========
    showToast(message, type = 'info') {
        const toastId = 'toast-' + Date.now();
        const bgClass = {
            'success': 'bg-success',
            'error': 'bg-danger',
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-info';

        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        $('#toastContainer').append(toastHtml);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    previewTemplate(event) {
        const templateId = $(event.currentTarget).data('template');
        this.showToast(
            this.currentLanguage === 'ar' ? 
            `معاينة قالب ${this.getTemplateName(templateId)}` :
            `Previewing ${this.getTemplateName(templateId, 'en')} template`,
            'info'
        );
    }
}

// Initialize the application
$(document).ready(function() {
    window.cvGenerator = new CVGenerator();
});

// دالة محسنة لجمع البيانات لكل نوع حقل
// دالة محسنة لجمع البيانات لكل نوع حقل
function collectEnhancementData(fieldType, fieldElement) {
    const baseData = {
        prompt: fieldElement.value,
        field_type: fieldType,
        language: document.getElementById('language').value,
        organization: document.getElementById('organization').value,
        target_job_title: document.getElementById('target_job_title').value,
    };

    switch(fieldType) {
        case 'experience':
        case 'experience_description':
            const experienceItem = fieldElement.closest('.experience-item');
            return {
                ...baseData,
                job_title: experienceItem.querySelector('input[name*=\"[title]\"]').value,
                job_info: experienceItem.querySelector('input[name*=\"[company]\"]').value,
                start_date: experienceItem.querySelector('input[name*=\"[start_date]\"]').value,
                end_date: experienceItem.querySelector('input[name*=\"[end_date]\"]').value
            };
            
            return {
                ...baseData,
                job_title: expTitle, // التصحيح: استخدام المسمى في الخبرة وليس المسمى الحالي
                job_info: expCompany,
                start_date: expStartDate,
                end_date: expEndDate
            };

        case 'education':
        case 'education_description':
            const educationItem = fieldElement.closest('.education-item');
            const degree = educationItem.querySelector('input[name$="[degree]"]').value;
            const institution = educationItem.querySelector('input[name$="[institution]"]').value;
            const eduStartDate = educationItem.querySelector('input[name$="[start_date]"]').value;
            const eduEndDate = educationItem.querySelector('input[name$="[end_date]"]').value;
            
            return {
                ...baseData,
                job_title: document.querySelector('input[name="personal_info[job_title]"]').value,
                job_info: `${degree} - ${institution}`,
                start_date: eduStartDate,
                end_date: eduEndDate
            };

        case 'summary':
            return {
                ...baseData,
                job_title: document.querySelector('input[name="personal_info[job_title]"]').value,
                job_info: ""
            };

        case 'skills':
            return {
                ...baseData,
                job_title: document.querySelector('input[name="personal_info[job_title]"]').value,
                job_info: ""
            };

        case 'job_title':
            return {
                ...baseData,
                job_title: fieldElement.value,
                job_info: "",
                target_job_title: document.getElementById('target_job_title').value
            };

        case 'target_job_title':
            return {
                ...baseData,
                job_title: document.querySelector('input[name="personal_info[job_title]"]').value,
                job_info: "",
                target_job_title: fieldElement.value
            };

        case 'experience_title':
            const expItemForTitle = fieldElement.closest('.experience-item');
            const expCompanyForTitle = expItemForTitle.querySelector('input[name$="[company]"]').value;
            return {
                ...baseData,
                job_title: fieldElement.value,
                job_info: expCompanyForTitle,
                start_date: expItemForTitle.querySelector('input[name$="[start_date]"]').value,
                end_date: expItemForTitle.querySelector('input[name$="[end_date]"]').value
            };

        case 'extra':
        case 'extra_description':
            return {
                ...baseData,
                job_title: document.querySelector('input[name="personal_info[job_title]"]').value,
                job_info: ""
            };

        default:
            return {
                ...baseData,
                job_info: ""
            };
    }
}


function initializeEnhancementButtons() {
    document.querySelectorAll('.ai-enhance').forEach(button => {
        button.addEventListener('click', function() {
            const fieldType = this.getAttribute('data-field');
            const inputGroup = this.closest('.input-group');
            const fieldElement = inputGroup.querySelector('input, textarea');
            
            // التحقق من أن الحقل غير فارغ إذا كان مطلوباً
            if (!fieldElement.value.trim() && fieldElement.hasAttribute('required')) {
                showEnhancementError(fieldElement, 'هذا الحقل مطلوب');
                return;
            }
            
            enhanceField(fieldType, fieldElement, this);
        });
    });
}

// دالة رئيسية للتحسين
function enhanceField(fieldType, fieldElement, buttonElement) {
    const enhancementData = collectEnhancementData(fieldType, fieldElement);
    
    // إظهار loading
    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    buttonElement.disabled = true;
    
    fetch('/enhance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(enhancementData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            fieldElement.value = data.enhanced_text;
            showEnhancementSuccess(fieldElement);
            updateStyleLevel(); // تحديث مستوى الأسلوب بعد التحسين الناجح
        } else {
            throw new Error(data.error || 'فشل في التحسين');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showEnhancementError(fieldElement, 'حدث خطأ أثناء التحسين. يرجى المحاولة مرة أخرى.');
    })
    .finally(() => {
        // إعادة الزر لحالته الأصلية
        buttonElement.innerHTML = originalText;
        buttonElement.disabled = false;
    });
}

// دالة لإظهار نجاح التحسين
function showEnhancementSuccess(fieldElement) {
    const originalBorder = fieldElement.style.border;
    const originalBackground = fieldElement.style.backgroundColor;
    
    fieldElement.style.border = '2px solid #28a745';
    fieldElement.style.backgroundColor = '#f8fff9';
    
    // إنشاء عنصر رسالة النجاح
    const successMessage = document.createElement('div');
    successMessage.className = 'enhancement-success-message text-success small mt-1';
    successMessage.innerHTML = '<i class="fas fa-check-circle me-1"></i>تم التحسين بنجاح';
    
    const parent = fieldElement.parentElement;
    const existingMessage = parent.querySelector('.enhancement-success-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    parent.appendChild(successMessage);
    
    setTimeout(() => {
        fieldElement.style.border = originalBorder;
        fieldElement.style.backgroundColor = originalBackground;
        successMessage.remove();
    }, 3000);
}

// دالة لإظهار خطأ التحسين
function showEnhancementError(fieldElement, message) {
    const originalBorder = fieldElement.style.border;
    
    fieldElement.style.border = '2px solid #dc3545';
    
    // إنشاء عنصر رسالة الخطأ
    const errorMessage = document.createElement('div');
    errorMessage.className = 'enhancement-error-message text-danger small mt-1';
    errorMessage.innerHTML = `<i class="fas fa-exclamation-circle me-1"></i>${message}`;
    
    const parent = fieldElement.parentElement;
    const existingMessage = parent.querySelector('.enhancement-error-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    parent.appendChild(errorMessage);
    
    setTimeout(() => {
        fieldElement.style.border = originalBorder;
        errorMessage.remove();
    }, 5000);
}

// إدارة مستوى الأسلوب
let styleLevel = 1;
let enhancementCount = 0;

function updateStyleLevel() {
    enhancementCount++;
    
    // كل تحسينين يزيدان مستوى الأسلوب
    if (enhancementCount % 2 === 0 && styleLevel < 5) {
        styleLevel++;
        updateStyleLevelDisplay();
    }
}

function updateStyleLevelDisplay() {
    const styleLevelDisplay = document.getElementById('styleLevelDisplay');
    const styleProgressBar = document.getElementById('styleProgressBar');
    
    const styleLevels = {
        1: { en: 'Modern Professional', ar: 'مهني عصري' },
        2: { en: 'Advanced Professional', ar: 'مهني متقدم' },
        3: { en: 'Executive Level', ar: 'مستوى إداري' },
        4: { en: 'Leadership Style', ar: 'أسلوب قيادي' },
        5: { en: 'Expert Level', ar: 'مستوى خبير' }
    };
    
    const progressPercentage = (styleLevel / 5) * 100;
    
    if (styleLevelDisplay) {
        const currentLang = document.getElementById('language').value;
        const levelText = styleLevels[styleLevel][currentLang];
        styleLevelDisplay.innerHTML = currentLang === 'ar' 
            ? `مستوى الأسلوب: ${styleLevel} (${levelText})`
            : `Style Level: ${styleLevel} (${levelText})`;
    }
    
    if (styleProgressBar) {
        styleProgressBar.style.width = `${progressPercentage}%`;
        styleProgressBar.setAttribute('aria-valuenow', progressPercentage);
    }
}


// دالة لإضافة حقول ديناميكية
function addDynamicField(type) {
    const container = document.getElementById(`${type}Fields`);
    const items = container.querySelectorAll(`.${type}-item`);
    const newIndex = items.length;
    
    const template = getFieldTemplate(type, newIndex);
    const newItem = document.createElement('div');
    newItem.className = `${type}-item mb-3 border-top pt-3`;
    newItem.innerHTML = template;
    
    container.appendChild(newItem);
    
    // إعادة تهيئة أزرار التحسين للحقل الجديد - التصحيح
    initializeEnhancementButtonsForItem(newItem);
    
    // إضافة التحقق من التواريخ
    const dateInputs = newItem.querySelectorAll('.experience-date, .education-date');
    dateInputs.forEach(input => {
        input.addEventListener('change', validateDates);
    });
}


// قوالب الحقول الديناميكية
function getFieldTemplate(type, index) {
    const templates = {
        experience: `
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Job Title" data-ar="المسمى الوظيفي">Job Title</label>
                        <div class="input-group">
                            <input type="text" class="form-control" name="experience[${index}][title]" 
                                   data-field-type="experience_title"
                                   maxlength="100">
                            <button type="button" class="btn btn-outline-primary ai-enhance" data-field="experience_title">
                                <i class="fas fa-wand-magic-sparkles"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Company" data-ar="الشركة">Company</label>
                        <input type="text" class="form-control" name="experience[${index}][company]" 
                               data-field-type="company"
                               maxlength="100">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="Start Date" data-ar="تاريخ البدء">Start Date *</label>
                        <input type="month" class="form-control experience-date" 
                               name="experience[${index}][start_date]" 
                               data-field-type="start_date"
                               required>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="End Date" data-ar="تاريخ الانتهاء">End Date</label>
                        <input type="month" class="form-control experience-date" 
                               name="experience[${index}][end_date]" 
                               data-field-type="end_date">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 d-flex align-items-end h-100">
                        <div class="form-check">
                            <input class="form-check-input experience-current" 
                                   type="checkbox" 
                                   name="experience[${index}][current]" 
                                   id="exp_current_${index}"
                                   data-field-type="current">
                            <label class="form-check-label" for="exp_current_${index}" data-en="Current Position" data-ar="الوظيفة الحالية">
                                Current Position
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label" data-en="Description" data-ar="الوصف">Description</label>
                <div class="input-group">
                    <textarea class="form-control" rows="3" name="experience[${index}][description]" 
                              data-field-type="experience_description"
                              maxlength="1000"></textarea>
                    <button type="button" class="btn btn-outline-primary ai-enhance" data-field="experience">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            </div>
            <div class="date-validation-message text-danger small mb-2" style="display: none;"></div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                <i class="fas fa-trash me-1"></i>
                <span data-en="Remove" data-ar="حذف">Remove</span>
            </button>
        `,
        
        education: `
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Degree" data-ar="الدرجة العلمية">Degree</label>
                        <input type="text" class="form-control" name="education[${index}][degree]" 
                               data-field-type="degree"
                               maxlength="100">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Institution" data-ar="المؤسسة">Institution</label>
                        <input type="text" class="form-control" name="education[${index}][institution]" 
                               data-field-type="institution"
                               maxlength="100">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="Start Date" data-ar="تاريخ البدء">Start Date</label>
                        <input type="month" class="form-control education-date" 
                               name="education[${index}][start_date]" 
                               data-field-type="start_date">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="End Date" data-ar="تاريخ الانتهاء">End Date</label>
                        <input type="month" class="form-control education-date" 
                               name="education[${index}][end_date]" 
                               data-field-type="end_date">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 d-flex align-items-end h-100">
                        <div class="form-check">
                            <input class="form-check-input education-current" 
                                   type="checkbox" 
                                   name="education[${index}][current]" 
                                   id="edu_current_${index}"
                                   data-field-type="current">
                            <label class="form-check-label" for="edu_current_${index}" data-en="Current Study" data-ar="الدراسة الحالية">
                                Current Study
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label" data-en="Description" data-ar="الوصف">Description</label>
                <div class="input-group">
                    <textarea class="form-control" rows="2" name="education[${index}][description]" 
                              data-field-type="education_description"
                              maxlength="500"></textarea>
                    <button type="button" class="btn btn-outline-primary ai-enhance" data-field="education">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            </div>
            <div class="date-validation-message text-danger small mb-2" style="display: none;"></div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                <i class="fas fa-trash me-1"></i>
                <span data-en="Remove" data-ar="حذف">Remove</span>
            </button>
        `
    };
    
    return templates[type] || '';
}

// التحقق من صحة التواريخ
function validateDates() {
    const item = this.closest('.experience-item, .education-item');
    const startDateInput = item.querySelector('input[name$="[start_date]"]');
    const endDateInput = item.querySelector('input[name$="[end_date]"]');
    const currentCheckbox = item.querySelector('.experience-current, .education-current');
    const messageElement = item.querySelector('.date-validation-message');
    
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (!startDate) return;
    
    if (endDate && endDate < startDate && !currentCheckbox?.checked) {
        messageElement.textContent = document.getElementById('language').value === 'ar' 
            ? 'تاريخ الانتهاء لا يمكن أن يكون قبل تاريخ البدء' 
            : 'End date cannot be before start date';
        messageElement.style.display = 'block';
        endDateInput.setCustomValidity('Invalid date range');
    } else {
        messageElement.style.display = 'none';
        endDateInput.setCustomValidity('');
    }
}

// تهيئة التحقق من التواريخ للحقول الموجودة
document.querySelectorAll('.experience-date, .education-date').forEach(input => {
    input.addEventListener('change', validateDates);
});

// تحديث عرض مستوى الأسلوب عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    updateStyleLevelDisplay();
});

// دالة جديدة لتهيئة أزرار التحسين للعنصر الجديد فقط
function initializeEnhancementButtonsForItem(item) {
    const buttons = item.querySelectorAll('.ai-enhance');
    buttons.forEach(button => {
        // إزالة أي event listeners سابقة لمنع التكرار
        button.replaceWith(button.cloneNode(true));
    });
    
    // إعادة الحصول على الأزرار بعد الاستبدال
    const newButtons = item.querySelectorAll('.ai-enhance');
    newButtons.forEach(button => {
        button.addEventListener('click', function() {
            const fieldType = this.getAttribute('data-field');
            const inputGroup = this.closest('.input-group');
            const fieldElement = inputGroup.querySelector('input, textarea');
            
            // التحقق من أن الحقل غير فارغ إذا كان مطلوباً
            if (!fieldElement.value.trim() && fieldElement.hasAttribute('required')) {
                showEnhancementError(fieldElement, 'هذا الحقل مطلوب');
                return;
            }
            
            enhanceField(fieldType, fieldElement, this);
        });
    });
}

// قوالب الحقول الديناميكية - التأكد من أنها تحتوي على data-field الصحيح
function getFieldTemplate(type, index) {
    const templates = {
        experience: `
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Job Title" data-ar="المسمى الوظيفي">Job Title</label>
                        <div class="input-group">
                            <input type="text" class="form-control" name="experience[${index}][title]" 
                                   data-field-type="experience_title"
                                   maxlength="100">
                            <button type="button" class="btn btn-outline-primary ai-enhance" data-field="experience_title">
                                <i class="fas fa-wand-magic-sparkles"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Company" data-ar="الشركة">Company</label>
                        <input type="text" class="form-control" name="experience[${index}][company]" 
                               data-field-type="company"
                               maxlength="100">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="Start Date" data-ar="تاريخ البدء">Start Date *</label>
                        <input type="month" class="form-control experience-date" 
                               name="experience[${index}][start_date]" 
                               data-field-type="start_date"
                               required>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="End Date" data-ar="تاريخ الانتهاء">End Date</label>
                        <input type="month" class="form-control experience-date" 
                               name="experience[${index}][end_date]" 
                               data-field-type="end_date">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 d-flex align-items-end h-100">
                        <div class="form-check">
                            <input class="form-check-input experience-current" 
                                   type="checkbox" 
                                   name="experience[${index}][current]" 
                                   id="exp_current_${index}"
                                   data-field-type="current">
                            <label class="form-check-label" for="exp_current_${index}" data-en="Current Position" data-ar="الوظيفة الحالية">
                                Current Position
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label" data-en="Description" data-ar="الوصف">Description</label>
                <div class="input-group">
                    <textarea class="form-control" rows="3" name="experience[${index}][description]" 
                              data-field-type="experience_description"
                              maxlength="1000"></textarea>
                    <button type="button" class="btn btn-outline-primary ai-enhance" data-field="experience">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            </div>
            <div class="date-validation-message text-danger small mb-2" style="display: none;"></div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                <i class="fas fa-trash me-1"></i>
                <span data-en="Remove" data-ar="حذف">Remove</span>
            </button>
        `,
        
        education: `
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Degree" data-ar="الدرجة العلمية">Degree</label>
                        <input type="text" class="form-control" name="education[${index}][degree]" 
                               data-field-type="degree"
                               maxlength="100">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label" data-en="Institution" data-ar="المؤسسة">Institution</label>
                        <input type="text" class="form-control" name="education[${index}][institution]" 
                               data-field-type="institution"
                               maxlength="100">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="Start Date" data-ar="تاريخ البدء">Start Date</label>
                        <input type="month" class="form-control education-date" 
                               name="education[${index}][start_date]" 
                               data-field-type="start_date">
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="mb-3">
                        <label class="form-label" data-en="End Date" data-ar="تاريخ الانتهاء">End Date</label>
                        <input type="month" class="form-control education-date" 
                               name="education[${index}][end_date]" 
                               data-field-type="end_date">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3 d-flex align-items-end h-100">
                        <div class="form-check">
                            <input class="form-check-input education-current" 
                                   type="checkbox" 
                                   name="education[${index}][current]" 
                                   id="edu_current_${index}"
                                   data-field-type="current">
                            <label class="form-check-label" for="edu_current_${index}" data-en="Current Study" data-ar="الدراسة الحالية">
                                Current Study
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label" data-en="Description" data-ar="الوصف">Description</label>
                <div class="input-group">
                    <textarea class="form-control" rows="2" name="education[${index}][description]" 
                              data-field-type="education_description"
                              maxlength="500"></textarea>
                    <button type="button" class="btn btn-outline-primary ai-enhance" data-field="education">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            </div>
            <div class="date-validation-message text-danger small mb-2" style="display: none;"></div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                <i class="fas fa-trash me-1"></i>
                <span data-en="Remove" data-ar="حذف">Remove</span>
            </button>
        `,
        
        extra: `
            <div class="mb-3">
                <label class="form-label" data-en="Title" data-ar="العنوان">Title</label>
                <input type="text" class="form-control" name="extra[${index}][title]" 
                       data-field-type="extra_title"
                       maxlength="100">
            </div>
            <div class="mb-3">
                <label class="form-label" data-en="Description" data-ar="الوصف">Description</label>
                <div class="input-group">
                    <textarea class="form-control" rows="2" name="extra[${index}][description]" 
                              data-field-type="extra_description"
                              maxlength="500"></textarea>
                    <button type="button" class="btn btn-outline-primary ai-enhance" data-field="extra">
                        <i class="fas fa-wand-magic-sparkles"></i>
                    </button>
                </div>
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm remove-field">
                <i class="fas fa-trash me-1"></i>
                <span data-en="Remove" data-ar="حذف">Remove</span>
            </button>
        `
    };
    
    return templates[type] || '';
}

// تحديث دالة التهيئة الرئيسية
document.getElementById('addExperience')?.addEventListener('click', function() {
    window.formManager.addExperienceField();   //  صح
    window.formManager.bindEnhancementButtons(); // ضروري لإعادة ربط أزرار AI
});

    // إضافة تعليم جديد
    document.getElementById('addEducation')?.addEventListener('click', function() {
        addDynamicField('education');
    });
    
    // إضافة قسم إضافي جديد
    document.getElementById('addExtra')?.addEventListener('click', function() {
        addDynamicField('extra');
    });
    
    // إزالة الحقول - التصحيح
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-field')) {
            const item = e.target.closest('.experience-item, .education-item, .extra-item');
            if (item) {
                item.remove();
            }
        }
    });


// ===== HOTFIX (2025-11-08): Prevent duplicate fields & legacy enhancement from running =====
(function(){
    try {
        // Disable legacy dynamic-field system so only CVGenerator methods handle add buttons
        if (typeof window.addDynamicField === 'function') {
            window.__LegacyAddDynamicField__ = window.addDynamicField;
            window.addDynamicField = function(){ /* disabled to avoid duplicates */ };
        }
        if (typeof window.initializeDynamicFields === 'function') {
            window.__LegacyInitDynamic__ = window.initializeDynamicFields;
            window.initializeDynamicFields = function(){ /* disabled to avoid duplicates */ };
        }
        // Disable legacy enhancement button initializer and handler (spinner provided by class method)
        if (typeof window.initializeEnhancementButtons === 'function') {
            window.__LegacyInitEnhance__ = window.initializeEnhancementButtons;
            window.initializeEnhancementButtons = function(){ /* disabled, using class-based system */ };
        }
        if (typeof window.enhanceField === 'function') {
            window.__LegacyEnhanceField__ = window.enhanceField;
            window.enhanceField = function(){ /* disabled, using enhanceWithAI() */ };
        }
    } catch(e) {
        console.warn('Hotfix guard failed:', e);
    }
})(); 
// ===== END HOTFIX =====
