# HQL_ Nhận Dạng

Ứng dụng web nhận diện cử chỉ bàn tay thời gian thực sử dụng MediaPipe Hand Landmarker.

## Tính năng chính
- Nhận diện **hai tay tạo hình trái tim** → Hiệu ứng trái tim bay lên.
- Nhận diện **hai ngón cái giơ lên (Thumbs Up)** → Hiệu ứng pháo hoa.
- Giao diện Dark Neon, responsive.
- Hỗ trợ camera trước/sau trên điện thoại.
- Hiển thị FPS, số tay, trạng thái.

## Cấu trúc thư mục
```
HQL-Nhan-Dang/
├── index.html
├── style.css
├── script.js
├── effects.js
├── gesture.js
├── config.js
├── data/
│   └── gestures.json
└── README.md
```

## Công nghệ
- HTML5, CSS3, JavaScript ES Modules.
- MediaPipe Tasks Vision (CDN).
- Canvas API.

## Chạy Local
1. Clone repo.
2. Mở `index.html` bằng Live Server (khuyến nghị) hoặc bất kỳ static server nào.
   - Lưu ý: MediaPipe yêu cầu HTTPS hoặc localhost để truy cập camera.

## Deploy GitHub Pages
1. Push code lên GitHub repository.
2. Vào Settings → Pages.
3. Chọn branch `main`, thư mục `/ (root)`.
4. Save và đợi deploy.

## Deploy Vercel
1. Import repository vào Vercel.
2. Framework Preset: **Other**.
3. Build Command: để trống.
4. Output Directory: để trống (hoặc `.`).
5. Deploy.

## Lưu ý
- Camera chỉ hoạt động trên HTTPS hoặc localhost.
- Model được tải từ Google Storage, cần kết nối internet.
- Cooldown hiệu ứng: 3 giây sau mỗi lần kích hoạt.
