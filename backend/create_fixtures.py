import os
import zipfile
from pathlib import Path
import pymupdf

FIXTURES_DIR = Path(__file__).parent / "backend" / "tests" / "fixtures"
if not FIXTURES_DIR.exists():
    FIXTURES_DIR = Path("tests/fixtures")
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)


def create_french_pdf():
    """Create a 2-page sample French PDF with running headers, footers, hyphens, and TOC."""
    pdf_path = FIXTURES_DIR / "sample_french.pdf"
    doc = pymupdf.open()

    # Page 1
    page1 = doc.new_page(width=595, height=842)
    # Header
    page1.insert_text(pymupdf.Point(50, 40), "Victor Hugo - Les Misérables", fontsize=10)
    # Body
    text_p1 = (
        "Chapitre I : Un Juste\n\n"
        "En 1815, M. Charles-François-Bienvenu Myriel était évêque de Digne. "
        "C'était un vieillard d'environ soixante-quinze ans ; il occupait le siège de Digne depuis 1806.\n\n"
        "Quoique ce détail ne touche en aucune manière au fond même de ce que nous avons à raconter, "
        "il n'est peut-être pas inutile d'indiquer ici les bruits et les propos qui avaient couru sur son compte.\n\n"
        "Il avait accompli durant sa jeunesse des actions extraordi-\n"
        "naires qui avaient frappé les esprits."
    )
    rect1 = pymupdf.Rect(50, 80, 545, 750)
    page1.insert_textbox(rect1, text_p1, fontsize=12)
    # Footer
    page1.insert_text(pymupdf.Point(280, 800), "— 1 —", fontsize=10)

    # Page 2
    page2 = doc.new_page(width=595, height=842)
    # Header
    page2.insert_text(pymupdf.Point(50, 40), "Victor Hugo - Les Misérables", fontsize=10)
    # Body
    text_p2 = (
        "Chapitre II : La chute\n\n"
        "Dans les premiers jours du mois d'octobre 1815, un homme entra à pied dans la petite ville de Digne. "
        "Cet homme marchait péniblement. Les rares passants le regardaient avec méfiance.\n\n"
        "Il cherchait un abri pour la nuit, mais toutes les portes demeuraient fermées devant lui.\n\n"
        "L'évêque l'accueillit avec bienveillance et lui offrit un repas chaud."
    )
    rect2 = pymupdf.Rect(50, 80, 545, 750)
    page2.insert_textbox(rect2, text_p2, fontsize=12)
    # Footer
    page2.insert_text(pymupdf.Point(280, 800), "— 2 —", fontsize=10)

    # Outline / TOC
    toc = [
        [1, "Chapitre I : Un Juste", 1],
        [1, "Chapitre II : La chute", 2],
    ]
    doc.set_toc(toc)
    doc.set_metadata({"title": "Les Misérables", "author": "Victor Hugo"})

    doc.save(str(pdf_path))
    doc.close()
    print(f"Created {pdf_path}")


def create_scanned_pdf():
    """Create a sample scanned PDF that contains an image but no extractable text."""
    pdf_path = FIXTURES_DIR / "sample_scanned.pdf"
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    # Insert a blank image / pixmap without any text
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 400, 600), 1)
    pix.clear_with(240)  # light gray background simulating a scanned page
    img_rect = pymupdf.Rect(50, 50, 545, 792)
    page.insert_image(img_rect, pixmap=pix)

    doc.set_metadata({"title": "Document Numérisé", "author": "Inconnu"})
    doc.save(str(pdf_path))
    doc.close()
    print(f"Created {pdf_path}")


def create_french_epub():
    """Create a sample French public domain EPUB with 2 chapters."""
    epub_path = FIXTURES_DIR / "sample_french.epub"

    container_xml = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""

    content_opf = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Le Tour du monde en 80 jours</dc:title>
    <dc:creator>Jules Verne</dc:creator>
    <dc:language>fr</dc:language>
    <dc:identifier id="BookId">urn:uuid:12345-67890-verne</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>"""

    toc_ncx = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:12345-67890-verne"/>
  </head>
  <docTitle><text>Le Tour du monde en 80 jours</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>Chapitre I</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>Chapitre II</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>"""

    chapter1_html = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapitre I : Dans lequel Phileas Fogg et Passepartout s'acceptent réciproquement</title>
</head>
<body>
  <h1>Chapitre I</h1>
  <p>En l'année 1872, la maison portant le numéro 7 de Saville-row, Burlington Gardens, était habitée par Phileas Fogg, esq.</p>
  <p>Cet homme singulier ne parlait guère et semblait ne faire aucun mouvement superflu.</p>
  <p>Ce matin-là, il engagea Jean Passepartout, un brave garçon parisien qui cherchait une existence paisible.</p>
</body>
</html>"""

    chapter2_html = """<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapitre II : Où Passepartout est convaincu qu'il a enfin trouvé son idéal</title>
</head>
<body>
  <h1>Chapitre II</h1>
  <p>Passepartout examina avec attention la demeure de son nouveau maître.</p>
  <p>Une régularité parfaite régnait dans toutes les pièces de la maison.</p>
  <p>Le domestique se réjouissait à l'idée d'une vie tranquille et méthodique auprès de ce gentleman anglais.</p>
</body>
</html>"""

    with zipfile.ZipFile(str(epub_path), "w", zipfile.ZIP_DEFLATED) as zf:
        # mimetype must be first and uncompressed
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr("META-INF/container.xml", container_xml)
        zf.writestr("OEBPS/content.opf", content_opf)
        zf.writestr("OEBPS/toc.ncx", toc_ncx)
        zf.writestr("OEBPS/chapter1.xhtml", chapter1_html)
        zf.writestr("OEBPS/chapter2.xhtml", chapter2_html)

    print(f"Created {epub_path}")


if __name__ == "__main__":
    create_french_pdf()
    create_scanned_pdf()
    create_french_epub()
