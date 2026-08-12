/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - SMART AUTO-MAPPER ENGINE
   ========================================================================== */

class AutoMapper {
  constructor() {
    this.synonyms = {
      'Name': ['student name', 'participant name', 'full name', 'candidate', 'name', 'participant', 'candidate name', 'student'],
      'College': ['institute', 'college', 'university', 'organization', 'school', 'institution', 'college name', 'inst'],
      'Department': ['department', 'branch', 'course', 'program', 'specialization', 'dept', 'stream'],
      'Email': ['email', 'email address', 'e-mail', 'mail id', 'mail'],
      'Phone': ['phone', 'mobile', 'contact', 'phone number', 'contact number', 'mobile number'],
      'Register Number': ['register number', 'reg no', 'registration number', 'roll no', 'certificate id', 'id', 'reg_no'],
      'Event': ['event', 'workshop', 'hackathon', 'event name', 'program name', 'title'],
      'Grade': ['grade', 'score', 'marks', 'percentage', 'cgpa'],
      'Position': ['position', 'prize', 'rank', 'place', 'award'],
      'Date': ['date', 'issued date', 'completion date', 'event date'],
      'Team': ['team', 'team id', 'group', 'team name']
    };
  }

  autoMapTemplateToExcel(template, excel) {
    if (!template || !template.fields || !excel || !excel.headers) return;
    const headers = excel.headers || [];

    template.fields.forEach(field => {
      const fieldName = (field.field || '').trim().toLowerCase();
      
      // 1. Try exact header match
      let matchedHeader = headers.find(h => h.trim().toLowerCase() === fieldName);
      
      // 2. Try synonym match
      if (!matchedHeader) {
        for (const [targetKey, synList] of Object.entries(this.synonyms)) {
          if (synList.some(syn => fieldName.includes(syn) || syn.includes(fieldName))) {
            matchedHeader = headers.find(h => {
              const hClean = h.trim().toLowerCase();
              return synList.some(s => hClean.includes(s) || s.includes(hClean));
            });
            if (matchedHeader) break;
          }
        }
      }

      if (matchedHeader) {
        field.linkedColumn = matchedHeader;
      } else if (headers.length > 0 && !field.linkedColumn) {
        field.linkedColumn = headers[0];
      }
    });
  }

  detectMapping(headers) {
    const mapping = {};
    headers.forEach(header => {
      const cleanH = header.trim().toLowerCase();
      let matchedTarget = header;

      for (const [targetKey, synList] of Object.entries(this.synonyms)) {
        if (synList.some(syn => cleanH === syn || cleanH.includes(syn))) {
          matchedTarget = targetKey;
          break;
        }
      }
      mapping[header] = matchedTarget;
    });

    return mapping;
  }

  getDynamicVariables(excelFiles) {
    const varSet = new Set(['Name', 'College', 'Department', 'Date', 'Certificate ID']);
    excelFiles.forEach(file => {
      if (file.headers) {
        file.headers.forEach(h => varSet.add(h));
      }
    });
    return Array.from(varSet);
  }
}

window.autoMapper = new AutoMapper();
