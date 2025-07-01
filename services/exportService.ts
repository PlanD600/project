import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Project, FinancialTransaction } from '../types';

interface ProjectPortfolioData extends Project {
    teamName: string;
    teamLeaderName: string;
    status: string;
    progress: number;
    actualCost: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

export const exportPortfolioToPdf = (portfolioData: ProjectPortfolioData[]) => {
    const doc = new jsPDF();
    
    // Add Hebrew font support
    // doc.addFileToVFS('Hebrew-normal.ttf', hebrewFont);
    // doc.addFont('Hebrew-normal.ttf', 'Hebrew', 'normal');
    // doc.setFont('Hebrew');

    doc.setR2L(true);
    doc.setFontSize(18);
    doc.text('דוח פורטפוליו פרויקטים', 200, 22, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`הדוח הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}`, 200, 29, { align: 'right' });

    const tableColumn = ["עלות בפועל", "תקציב", "התקדמות", "סטטוס", "מוביל צוות", "צוות", "שם הפרויקט"];
    const tableRows: (string|number)[][] = [];

    portfolioData.forEach(project => {
        const projectData = [
            formatCurrency(project.actualCost),
            formatCurrency(project.budget),
            `${Math.round(project.progress)}%`,
            project.status,
            project.teamLeaderName,
            project.teamName,
            project.name
        ];
        tableRows.push(projectData);
    });

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: { font: 'Arial', halign: 'right' }, // Using Arial as a fallback for PDF standard fonts
        headStyles: { halign: 'right' },
    });

    doc.save('portfolio_report.pdf');
};


export const exportFinancesToCsv = (financialData: FinancialTransaction[], projectName: string) => {
    const headers = ['סוג', 'תאריך', 'מקור/שולם ל', 'תיאור', 'סכום', 'מזהה פרויקט'];
    const rows = financialData.map(tx => 
        [
            tx.type === 'Income' ? 'הכנסה' : 'הוצאה',
            new Date(tx.date).toLocaleDateString('he-IL'),
            `"${tx.source.replace(/"/g, '""')}"`,
            `"${tx.description.replace(/"/g, '""')}"`,
            tx.amount,
            tx.projectId
        ].join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `דוח_כספים_${projectName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


export const exportGanttToPdf = async (ganttElement: HTMLElement) => {
    try {
        const canvas = await html2canvas(ganttElement, {
            scale: 2,
            useCORS: true,
            scrollX: -window.scrollX,
            scrollY: -window.scrollY,
            windowWidth: ganttElement.scrollWidth,
            windowHeight: ganttElement.scrollHeight,
            backgroundColor: '#f5ebe0',
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('gantt_chart.pdf');
    } catch (error) {
        console.error('Error exporting Gantt chart:', error);
    }
};