import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../config/firebase";
import QRCode from "qrcode";
import { toast } from "react-toastify";

const CompanyQRCode = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportUrl, setReportUrl] = useState("");
  const [reportingEnabled, setReportingEnabled] = useState(true);
  const [caseCheckEnabled, setCaseCheckEnabled] = useState(true);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const buildReportUrl = (slug) =>
    `${(import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, "")}/r/${slug}`;

  const stepText = (key) => t(key).replace(/^\d+\.\s*/, "");

  useEffect(() => {
    if (userData?.role !== "company_admin") {
      navigate("/dashboard");
      return;
    }
    loadCompanyAndGenerateQR();
  }, [userData, navigate]);

  const loadCompanyAndGenerateQR = async () => {
    setLoading(true);
    try {
      // Load company data
      const companyDoc = await getDoc(doc(db, "companies", userData.companyId));

      if (companyDoc.exists()) {
        const companyData = { id: companyDoc.id, ...companyDoc.data() };
        setCompany(companyData);
        setReportingEnabled(companyData.reportingEnabled !== false);
        setCaseCheckEnabled(companyData.settings?.allowCaseProgressCheck !== false);

        let slug = companyData.reportSlug;
        if (!slug) {
          const created = await httpsCallable(functions, "ensureReportSlug")({ companyId: companyData.id });
          slug = created.data.slug;
        }
        await applyReportSlug(slug);
      }
    } catch (error) {
      console.error("Error loading report link:", error);
      setLinkError(t("report.link.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const applyReportSlug = async (slug) => {
    const url = buildReportUrl(slug);
    setReportUrl(url);
    await generateQRCode(url);
  };

  const regenerateLink = async () => {
    setConfirmRegenerate(false);
    setLinkBusy(true);
    setLinkError("");
    try {
      const rotated = await httpsCallable(functions, "ensureReportSlug")({
        companyId: company.id,
        rotate: true,
      });
      await applyReportSlug(rotated.data.slug);
      toast.success(t("report.link.regenerated"));
    } catch (error) {
      console.error("Error regenerating report link:", error);
      setLinkError(t("report.link.saveError"));
    } finally {
      setLinkBusy(false);
    }
  };

  const toggleReporting = async () => {
    const next = !reportingEnabled;
    setLinkBusy(true);
    setLinkError("");
    try {
      await httpsCallable(functions, "setReportingEnabled")({ companyId: company.id, enabled: next });
      setReportingEnabled(next);
    } catch (error) {
      console.error("Error updating reporting status:", error);
      setLinkError(t("report.link.saveError"));
    } finally {
      setLinkBusy(false);
    }
  };

  const toggleCaseCheck = async () => {
    const next = !caseCheckEnabled;
    setLinkBusy(true);
    setLinkError("");
    try {
      await httpsCallable(functions, "updateCompanySettings")({
        companyId: company.id,
        settings: { allowCaseProgressCheck: next },
      });
      setCaseCheckEnabled(next);
    } catch (error) {
      console.error("Error updating case progress setting:", error);
      setLinkError(t("report.link.saveError"));
    } finally {
      setLinkBusy(false);
    }
  };

  const generateQRCode = async (qrData) => {
    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 2,
        color: {
          dark: "#0284c7",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      });

      setQrCodeUrl(url);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl || !company) return;

    // Create a canvas to render the full document
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size for a document (2 pages at 800px width)
    canvas.width = 800;
    canvas.height = 2200; // Increased height for 2 pages

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load logo image
    const logoImage = new Image();
    logoImage.crossOrigin = 'anonymous';
    logoImage.src = window.location.origin + '/voxwel-logo.png';

    // Load QR code image
    const qrImage = new Image();
    qrImage.crossOrigin = 'anonymous';

    let imagesLoaded = 0;
    const totalImages = 2;

    const onImageLoad = () => {
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        drawCanvas();
      }
    };

    logoImage.onload = onImageLoad;
    qrImage.onload = onImageLoad;

    const drawCanvas = () => {
      // PAGE 1 - QR Code and Company Info
      let yPosition = 60;

      // Draw VoxWel Logo
      const logoSize = 80;
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = yPosition;
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

      yPosition = 150;

      // App Name - VoxWel
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 48px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VoxWel', 400, yPosition);

      yPosition += 50;

      // Tagline
      ctx.fillStyle = '#9ca3af';
      ctx.font = '20px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('Where Every Voice Matters', 400, yPosition);

      yPosition += 50;

      // Company Name
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 36px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(company.name, 400, yPosition);

      yPosition += 60;

      // Draw QR code
      const qrSize = 400;
      const qrX = (canvas.width - qrSize) / 2;
      ctx.drawImage(qrImage, qrX, yPosition, qrSize, qrSize);

      yPosition += qrSize + 40;

      // Scan instruction
      ctx.fillStyle = '#374151';
      ctx.font = '600 22px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('📱 Scan with any phone camera or QR reader', 400, yPosition);

      yPosition += 60;

      // PAGE 2 - Instructions (starts at y = 1100)
      yPosition = 1100;

      // Draw logo on page 2
      const logoSize2 = 60;
      const logoX2 = (canvas.width - logoSize2) / 2;
      ctx.drawImage(logoImage, logoX2, yPosition, logoSize2, logoSize2);

      yPosition = 1200;

      // Page 2 title
      ctx.textAlign = 'center';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 36px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(t('report.link.howTitle'), 400, yPosition);

      yPosition += 70;

      // Instructions box
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(60, yPosition, 680, 350);
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, yPosition, 680, 350);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 22px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('📋 ' + t('report.link.stepsTitle'), 90, yPosition + 45);

      ctx.fillStyle = '#1f2937';
      ctx.font = '18px Inter, system-ui, -apple-system, sans-serif';
      const instructions = [
        t('report.link.step1'),
        t('report.link.step2'),
        t('report.link.step3'),
        t('report.link.step4'),
        t('report.link.step5')
      ];

      let instrY = yPosition + 90;
      instructions.forEach((instruction) => {
        ctx.fillText(instruction, 90, instrY);
        instrY += 40;
      });

      yPosition += 380;

      // Benefits box
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(60, yPosition, 680, 240);
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, yPosition, 680, 240);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 22px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('🌟 ' + t('report.link.whatTitle'), 90, yPosition + 45);

      ctx.fillStyle = '#78350f';
      ctx.font = '17px Inter, system-ui, -apple-system, sans-serif';
      const benefits = [
        '✓ ' + t('report.link.benefit1'),
        '✓ ' + t('report.link.benefit2'),
        '✓ ' + t('report.link.benefit3'),
        '✓ ' + t('report.link.benefit4')
      ];

      let benefitY = yPosition + 90;
      benefits.forEach((benefit) => {
        ctx.fillText(benefit, 90, benefitY);
        benefitY += 45;
      });

      yPosition += 270;

      // Footer
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(`© 2025 ${company.name} • VoxWel`, 400, yPosition);

      ctx.font = '14px Courier New, monospace';
      ctx.fillText(`Company ID: ${company.id}`, 400, yPosition + 30);

      // Download the canvas as image
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${company.name.replace(/\s+/g, '_')}_VoxWel_QR_Code.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    qrImage.src = qrCodeUrl;
  };

  const printQRCode = () => {
    if (!qrCodeUrl || !company) return;

    const printWindow = window.open("", "_blank");
    const logoUrl = window.location.origin + '/voxwel-logo.png';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${company.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              background: white;
              padding: 0;
            }

            .page {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              padding: 40px 40px;
              page-break-after: always;
            }

            .page:last-child {
              page-break-after: auto;
            }

            .print-container {
              background: white;
              max-width: 700px;
              width: 100%;
              text-align: center;
            }
            
            .header {
              margin-bottom: 30px;
            }

            .logo {
              width: 80px;
              height: 80px;
              margin: 0 auto 20px;
              display: block;
              object-fit: contain;
            }
            
            .company-name {
              font-size: 36px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 12px;
              line-height: 1.2;
            }
            
            .platform-name {
              font-size: 18px;
              color: #6b7280;
              font-weight: 500;
              margin-bottom: 8px;
            }
            
            .subtitle {
              font-size: 16px;
              color: #9ca3af;
              margin-bottom: 20px;
            }
            
            .divider {
              width: 100px;
              height: 4px;
              background: linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%);
              margin: 0 auto 40px;
              border-radius: 2px;
            }
            
            .qr-container {
              background: white;
              padding: 30px;
              border-radius: 24px;
              box-shadow: 0 0 0 12px #f0f9ff, 0 8px 24px rgba(0, 0, 0, 0.1);
              display: inline-block;
              margin-bottom: 30px;
            }
            
            .qr-container img {
              display: block;
              width: 350px;
              height: 350px;
              border-radius: 12px;
            }

            .scan-text {
              font-size: 18px;
              color: #374151;
              font-weight: 600;
              margin-bottom: 20px;
            }
            
            .instructions {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              padding: 32px;
              border-radius: 16px;
              text-align: left;
              margin: 40px 0;
              border: 2px solid #bae6fd;
            }
            
            .instructions-header {
              display: flex;
              align-items: center;
              margin-bottom: 20px;
            }
            
            .instructions-icon {
              width: 32px;
              height: 32px;
              background: #0284c7;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
            }
            
            .instructions h3 {
              color: #0369a1;
              font-size: 20px;
              font-weight: 700;
              margin: 0;
            }
            
            .instructions ol {
              margin: 0;
              padding-left: 24px;
              counter-reset: item;
            }
            
            .instructions li {
              margin-bottom: 12px;
              color: #1f2937;
              font-size: 15px;
              line-height: 1.6;
              position: relative;
              padding-left: 8px;
            }
            
            .instructions li:last-child {
              margin-bottom: 0;
            }
            
            .benefits {
              background: #fef3c7;
              border: 2px solid #fcd34d;
              padding: 24px;
              border-radius: 12px;
              margin: 30px 0;
            }
            
            .benefits h4 {
              color: #92400e;
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .benefits ul {
              list-style: none;
              padding: 0;
              margin: 0;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            
            .benefits li {
              color: #78350f;
              font-size: 14px;
              display: flex;
              align-items: center;
            }
            
            .benefits li:before {
              content: "✓";
              display: inline-block;
              width: 20px;
              height: 20px;
              background: #fbbf24;
              color: #78350f;
              border-radius: 50%;
              text-align: center;
              line-height: 20px;
              font-weight: bold;
              margin-right: 8px;
              flex-shrink: 0;
            }
            
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
            }
            
            .company-id {
              display: inline-block;
              background: #f3f4f6;
              padding: 12px 24px;
              border-radius: 8px;
              margin-bottom: 16px;
            }
            
            .company-id strong {
              color: #374151;
              font-size: 14px;
              font-weight: 600;
            }
            
            .company-id span {
              color: #6b7280;
              font-size: 12px;
              font-family: 'Courier New', monospace;
              margin-left: 8px;
            }
            
            .copyright {
              color: #9ca3af;
              font-size: 13px;
              margin-top: 12px;
            }
            
            @media print {
              body {
                background: white;
                padding: 0;
              }

              .page {
                min-height: 100vh;
                page-break-after: always;
                page-break-inside: avoid;
              }

              .page:last-child {
                page-break-after: auto;
              }

              .print-container {
                box-shadow: none;
                max-width: 100%;
              }

              .qr-container {
                box-shadow: none;
              }
            }

            @page {
              size: A4;
              margin: 1cm;
            }
          </style>
        </head>
        <body>
          <!-- PAGE 1: QR CODE -->
          <div class="page">
            <div class="print-container">
              <div class="header">
                <img src="${logoUrl}" alt="VoxWel Logo" class="logo" />

                <p class="platform-name">VoxWel</p>
                <p class="subtitle">Where Every Voice Matters</p>
                <h1 class="company-name">${company.name}</h1>
                <p class="subtitle" style="margin-top: 12px;">${t('report.link.scanToReport')}</p>
                <div class="divider"></div>
              </div>

              <div class="qr-container">
                <img src="${qrCodeUrl}" alt="Company QR Code" />
              </div>

              <p class="scan-text">📱 Scan with any phone camera or QR reader</p>

              <div class="footer">
                <div class="company-id">
                  <strong>Company ID:</strong>
                  <span>${company.id}</span>
                </div>
                <p class="copyright">© 2025 ${company.name} • VoxWel</p>
              </div>
            </div>
          </div>

          <!-- PAGE 2: INSTRUCTIONS -->
          <div class="page">
            <div class="print-container">
              <div class="header">
                <img src="${logoUrl}" alt="VoxWel Logo" class="logo" />
                <h1 class="company-name">${t('report.link.howTitle')}</h1>
                <div class="divider"></div>
              </div>

              <div class="instructions">
              <div class="instructions-header">
                <div class="instructions-icon">
                  <svg width="16" height="16" fill="white" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <h3>${t('report.link.howTitle')}</h3>
              </div>
              <ol>
                <li>${stepText('report.link.step1')}</li>
                <li>${stepText('report.link.step2')}</li>
                <li>${stepText('report.link.step3')}</li>
                <li>${stepText('report.link.step4')}</li>
                <li>${stepText('report.link.step5')}</li>
              </ol>
            </div>
            
              <div class="benefits">
                <h4>🌟 ${t('report.link.whatTitle')}</h4>
                <ul>
                  <li>${t('report.link.benefit1')}</li>
                  <li>${t('report.link.benefit2')}</li>
                  <li>${t('report.link.benefit3')}</li>
                  <li>${t('report.link.benefit4')}</li>
                </ul>
              </div>

              <div class="footer">
                <p class="copyright">© 2025 ${company.name} • VoxWel</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const shareQRCode = async () => {
    if (!qrCodeUrl || !company) return;

    try {
      // Create a canvas to render the share image with logo, app name, tagline, company name and QR
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set canvas size
      canvas.width = 800;
      canvas.height = 900;

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load logo image
      const logoImage = new Image();
      logoImage.crossOrigin = 'anonymous';
      logoImage.src = window.location.origin + '/voxwel-logo.png';

      // Load QR code image
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';

      let imagesLoaded = 0;
      const totalImages = 2;

      const onImageLoad = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          drawShareCanvas();
        }
      };

      logoImage.onload = onImageLoad;
      qrImage.onload = onImageLoad;

      const drawShareCanvas = async () => {
        let yPosition = 60;

        // Draw VoxWel Logo
        const logoSize = 100;
        const logoX = (canvas.width - logoSize) / 2;
        ctx.drawImage(logoImage, logoX, yPosition, logoSize, logoSize);

        yPosition += logoSize + 30;

        // App Name - VoxWel
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 48px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VoxWel', 400, yPosition);

        yPosition += 50;

        // Tagline
        ctx.fillStyle = '#6b7280';
        ctx.font = '24px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText('Where Every Voice Matters', 400, yPosition);

        yPosition += 60;

        // Company Name
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 36px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText(company.name, 400, yPosition);

        yPosition += 60;

        // Draw QR code
        const qrSize = 400;
        const qrX = (canvas.width - qrSize) / 2;
        ctx.drawImage(qrImage, qrX, yPosition, qrSize, qrSize);

        yPosition += qrSize + 30;

        // Scan instruction
        ctx.fillStyle = '#374151';
        ctx.font = '600 20px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText('📱 ' + t('report.link.scanToReport'), 400, yPosition);

        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          const file = new File([blob], `${company.name}_VoxWel_QR.png`, {
            type: "image/png",
          });

          const shareText = `${t('report.link.shareTitle', { company: company.name })}\n\n` +
            `📱 ${t('report.link.shareText')}\n\n` +
            `VoxWel - Where Every Voice Matters`;

          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: t('report.link.shareTitle', { company: company.name }),
              text: shareText,
              files: [file],
            });
          } else {
            const fullShareText = `${shareText}\n\n${reportUrl}`;
            await navigator.clipboard.writeText(fullShareText);
            toast.success(t('company.shareInfoCopied'));
          }
        });
      };

      qrImage.src = qrCodeUrl;
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error(t('company.unableToShare'));
    }
  };

  const copyCompanyId = () => {
    navigator.clipboard.writeText(company.id);
    toast.success(t('company.companyIdCopied'));
  };

  const copyReportLink = () => {
    if (!reportUrl) return;
    navigator.clipboard.writeText(reportUrl).then(() => {
      toast.success(t('report.link.linkCopied'));
    }).catch(() => {
      toast.error(reportUrl);
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#1ABC9C]" />
      </div>
    );
  }

  const tips = [
    t('report.link.tipEmail'),
    t('report.link.tipNoticeBoards'),
    t('report.link.tipHandbook'),
    t('report.link.tipOnboarding'),
  ];
  const practices = [
    t('company.bestPracticeHighRes'),
    t('company.bestPracticeTestScan'),
    t('company.bestPracticeKeepAccessible'),
    t('report.link.bestPracticeRotate'),
  ];
  const disabled = linkBusy || !company;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {t('report.link.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{t('report.link.instructions')}</p>
      </div>

      {linkError && (
        <p role="alert" className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {linkError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* QR + share (left) */}
        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <div
              className={`mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-2xl border border-gray-100 bg-white p-3 transition ${
                reportingEnabled ? '' : 'opacity-40 grayscale'
              }`}
            >
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Company QR Code" className="h-full w-full" />
              ) : (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#1ABC9C]" />
              )}
            </div>
            <p className="mx-auto mt-4 max-w-xs text-center text-sm text-gray-500">
              {t('report.link.scanDesc')}
            </p>

            {/* Link */}
            <div className="mt-6">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                {t('report.link.linkLabel')}
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700" title={reportUrl}>
                  {reportUrl || t('report.link.preparing')}
                </span>
                <button
                  onClick={copyReportLink}
                  disabled={!reportUrl}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  <Icon d={ICONS.link} className="h-3.5 w-3.5" />
                  {t('report.link.copyLink')}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <ActionButton primary onClick={downloadQRCode} icon={ICONS.download} label={t('company.downloadQR')} />
              <ActionButton onClick={printQRCode} icon={ICONS.print} label={t('company.print')} />
              <ActionButton onClick={shareQRCode} icon={ICONS.share} label={t('company.share')} />
            </div>
          </div>
        </section>

        {/* Settings, details, tips (right) */}
        <div className="space-y-6 lg:col-span-3">
          {/* Controls */}
          <section className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <p id="reporting-label" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span
                    className={`h-2 w-2 rounded-full ${reportingEnabled ? 'bg-[#1ABC9C]' : 'bg-gray-300'}`}
                    aria-hidden="true"
                  />
                  {reportingEnabled ? t('report.link.reportingOn') : t('report.link.reportingOff')}
                </p>
                <p className="mt-1 text-sm text-gray-500">{t('report.link.toggleHelp')}</p>
              </div>
              <Toggle checked={reportingEnabled} disabled={disabled} onChange={toggleReporting} labelledBy="reporting-label" />
            </div>

            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <p id="case-check-label" className="text-sm font-semibold text-gray-900">
                  {t('report.link.caseCheckLabel')}
                </p>
                <p className="mt-1 text-sm text-gray-500">{t('report.link.caseCheckHelp')}</p>
              </div>
              <Toggle checked={caseCheckEnabled} disabled={disabled} onChange={toggleCaseCheck} labelledBy="case-check-label" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="max-w-md text-sm text-gray-500">{t('report.link.regenerateBody')}</p>
              <button
                onClick={() => setConfirmRegenerate(true)}
                disabled={linkBusy || !reportUrl}
                className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {t('report.link.regenerate')}
              </button>
            </div>
          </section>

          {/* Company details */}
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">{t('company.companyDetails')}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <Detail label={t('company.companyName')} value={company?.name} />
              <Detail label={t('company.industry')} value={company?.industry || t('company.notSpecified')} />
              <Detail label={t('company.employees')} value={company?.employeeCount || 0} />
              <div>
                <dt className="text-xs text-gray-400">{t('company.status')}</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      company?.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {company?.isActive ? t('company.statusActive') : t('company.statusInactive')}
                  </span>
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{t('company.companyId')}</p>
                <code className="block truncate font-mono text-xs text-gray-700">{company?.id}</code>
              </div>
              <button
                onClick={copyCompanyId}
                title={t('company.companyId')}
                aria-label={t('company.companyId')}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-gray-700"
              >
                <Icon d={ICONS.copy} className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Tips */}
          <section className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2">
            <TipList title={t('company.distributionTips')} items={tips} />
            <TipList title={t('company.bestPractices')} items={practices} />
          </section>
        </div>
      </div>

      {confirmRegenerate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="regenerate-title"
          onClick={() => setConfirmRegenerate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="regenerate-title" className="text-lg font-semibold text-gray-900">
              {t('report.link.regenerateTitle')}
            </h3>
            <p className="mt-2 text-sm text-gray-500">{t('report.link.regenerateBody')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmRegenerate(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                {t('report.link.cancel')}
              </button>
              <button
                onClick={regenerateLink}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                {t('report.link.regenerateConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ICONS = {
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  print: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",
  share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
  link: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
};

const Icon = ({ d, className = "h-5 w-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ActionButton = ({ icon, label, onClick, primary }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABC9C] focus-visible:ring-offset-2 ${
      primary
        ? 'bg-[#1ABC9C] text-white hover:bg-[#17a589]'
        : 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100'
    }`}
  >
    <Icon d={icon} className="h-5 w-5" />
    <span className="text-center leading-tight">{label}</span>
  </button>
);

const Toggle = ({ checked, onChange, disabled, labelledBy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    disabled={disabled}
    onClick={onChange}
    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ABC9C] focus-visible:ring-offset-2 disabled:opacity-50 ${
      checked ? 'bg-[#1ABC9C]' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const Detail = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-gray-400">{label}</dt>
    <dd className="mt-1 truncate text-sm font-medium text-gray-900">{value}</dd>
  </div>
);

const TipList = ({ title, items }) => (
  <div>
    <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-gray-500">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1ABC9C]" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

export default CompanyQRCode;
