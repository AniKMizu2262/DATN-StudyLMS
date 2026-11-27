
# ======================================================
# KDOCUMENT | DAY20
# PDF EXTRACTION - PyMuPDF + Docling
#
# Mục đích:
# - Trích xuất nguyên văn theo trang bằng PyMuPDF
# - Trích xuất Markdown bằng Docling
# - Xuất JSON cho Node.js sử dụng
#
# Chưa chỉnh sửa MySQL hoặc dữ liệu RAG hiện tại.
# ======================================================

import argparse
import json
from pathlib import Path

import pymupdf
from docling.document_converter import DocumentConverter


def extract_pdf(pdf_path: Path):
    if not pdf_path.is_file():
        raise FileNotFoundError(f"Không tìm thấy PDF: {pdf_path}")

    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError("Chỉ hỗ trợ PDF")

    # [01] Đọc cấu trúc tài liệu bằng Docling
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))

    document = result.document
    pages = []

    # [02] Lấy dữ liệu văn bản từng trang
    with pymupdf.open(str(pdf_path)) as pdf:
        for index, page in enumerate(pdf):
            page_number = index + 1

            # Văn bản gốc
            raw_text = page.get_text(
                "text",
                sort=True
            ).strip()

            # Markdown của trang tương ứng
            readable_markdown = document.export_to_markdown(
                page_no=page_number
            ).strip()

            pages.append({
                "page_number": page_number,
                "raw_text": raw_text,
                "readable_markdown": readable_markdown
            })

    return {
        "total_pages": len(pages),
        "pages": pages
    }


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("pdf_path")
    parser.add_argument("output_path")

    args = parser.parse_args()

    pdf_path = Path(args.pdf_path).resolve()
    output_path = Path(args.output_path).resolve()

    data = extract_pdf(pdf_path)

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    output_path.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print(f"Đã xử lý {data['total_pages']} trang")
    print(f"JSON: {output_path}")


if __name__ == "__main__":
    main()
