"""Build the two editable Word reports from their Markdown sources (stdlib only)."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape
import re

DOCS = Path(__file__).resolve().parent
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
XML = 'http://www.w3.org/XML/1998/namespace'


def clean_inline(text):
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = text.replace('**', '').replace('__', '').replace('`', '').replace('*', '')
    return text


def paragraph(text, style='Normal', indent=False):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/>'
    if indent:
        ppr += '<w:ind w:left="420" w:hanging="220"/>'
    ppr += '</w:pPr>'
    return f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'


def markdown_body(source):
    output = []
    in_code = False
    for line in source.splitlines():
        if line.strip().startswith('```'):
            in_code = not in_code
            continue
        if not line.strip() or line.strip() == '---':
            continue
        if in_code:
            output.append(paragraph(clean_inline(line), 'Code', True))
        elif line.startswith('# '):
            output.append(paragraph(clean_inline(line[2:]), 'Title'))
        elif line.startswith('## '):
            output.append(paragraph(clean_inline(line[3:]), 'Heading1'))
        elif line.startswith('### '):
            output.append(paragraph(clean_inline(line[4:]), 'Heading2'))
        elif line.startswith('#### '):
            output.append(paragraph(clean_inline(line[5:]), 'Heading3'))
        elif line.startswith('- '):
            output.append(paragraph('•  ' + clean_inline(line[2:]), 'Normal', True))
        else:
            output.append(paragraph(clean_inline(line)))
    return ''.join(output)


def styles_xml():
    styles = [
        ('Normal', 'Normal', 22, False, '222222'),
        ('Title', 'Title', 38, True, '17365D'),
        ('Heading1', 'heading 1', 30, True, '1F4E79'),
        ('Heading2', 'heading 2', 25, True, '2F75B5'),
        ('Heading3', 'heading 3', 23, True, '404040'),
        ('Code', 'Code', 19, False, '333333'),
    ]
    entries = []
    for sid, name, size, bold, color in styles:
        b = '<w:b/>' if bold else ''
        font = 'Consolas' if sid == 'Code' else 'Aptos'
        before = 0 if sid == 'Normal' else (300 if sid == 'Title' else 260)
        after = 140 if sid == 'Normal' else 180
        keep_next = '<w:keepNext/>' if sid in ('Title', 'Heading1', 'Heading2', 'Heading3') else ''
        entries.append(
            f'<w:style w:type="paragraph" w:styleId="{sid}"><w:name w:val="{name}"/>'
            f'<w:rPr><w:rFonts w:ascii="{font}" w:hAnsi="{font}"/><w:sz w:val="{size}"/>'
            f'<w:color w:val="{color}"/>{b}</w:rPr>'
            f'<w:pPr><w:spacing w:before="{before}" w:after="{after}" w:line="300" w:lineRule="auto"/>'
            f'{keep_next}</w:pPr></w:style>'
        )
    return f'<w:styles xmlns:w="{W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>{"".join(entries)}</w:styles>'


def create_docx(markdown_path, output_path):
    source = markdown_path.read_text(encoding='utf-8')
    body = markdown_body(source)
    document = (
        f'<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{body}'
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>'
        '</w:sectPr></w:body></w:document>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        '</Types>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )
    core = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        f'<dc:title>{escape(markdown_path.stem.replace("-", " "))}</dc:title>'
        '<dc:creator>Projet Full Stack</dc:creator></cp:coreProperties>'
    )
    app = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Word</Application></Properties>'
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output_path, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', content_types)
        archive.writestr('_rels/.rels', root_rels)
        archive.writestr('word/document.xml', document)
        archive.writestr('word/styles.xml', styles_xml())
        archive.writestr('word/_rels/document.xml.rels', doc_rels)
        archive.writestr('docProps/core.xml', core)
        archive.writestr('docProps/app.xml', app)


if __name__ == '__main__':
    jobs = [
        ('rapport-p2.md', 'rapport-p2.docx'),
        ('rapport-fusion-p1-p2-p4.md', 'rapport-fusion-p1-p2-p4.docx'),
    ]
    for source, target in jobs:
        create_docx(DOCS / source, DOCS / target)
        print(f'Generated {target}')
