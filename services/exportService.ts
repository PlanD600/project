import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Project, FinancialTransaction } from '../types';

interface ProjectPortfolioData extends Project {
    teamName: string;
    teamLeaderName: string;
    progressStatus: string;
    progress: number;
    actualCost: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

// New approach: Render an HTML table, convert it to an image, and add to PDF.
export const exportPortfolioToPdf = async (portfolioData: ProjectPortfolioData[]) => {
    // 1. Create a temporary element to hold our table for rendering
    const tableContainer = document.createElement('div');
    
    // Style it to be off-screen so the user doesn't see it
    tableContainer.style.position = 'absolute';
    tableContainer.style.left = '-9999px';
    tableContainer.style.top = 'auto';
    tableContainer.style.direction = 'rtl';
    tableContainer.style.fontFamily = 'Arial, sans-serif'; // Use a common font
    tableContainer.style.width = '1200px'; // Give it a fixed width for better rendering
    tableContainer.style.padding = '20px';
    tableContainer.style.backgroundColor = '#ffffff';

    // 2. Build the HTML string for the table
    let tableHTML = `
        <h1 style="font-size: 24px; text-align: right; margin-bottom: 5px;">דוח פרויקטים</h1>
        <p style="font-size: 12px; text-align: right; margin-bottom: 20px;">הדוח הופק בתאריך: ${new Date().toLocaleDateString('he-IL')}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
                <tr style="background-color: #292d32; color: #ffffff;">
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">שם הפרויקט</th>
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">צוות</th>
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">מוביל צוות</th>
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">סטטוס</th>
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">התקדמות</th>
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">תקציב</th>
                    <th style="padding: 8px; border: 1px solid #dddddd; text-align: right;">עלות בפועל</th>
                </tr>
            </thead>
            <tbody>
    `;

    portfolioData.forEach(project => {
        tableHTML += `
            <tr style="background-color: #f9f9f9;">
                <td style="padding: 8px; border: 1px solid #dddddd;">${project.name}</td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${project.teamName}</td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${project.teamLeaderName}</td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${project.progressStatus}</td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${Math.round(project.progress)}%</td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${formatCurrency(project.budget)}</td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${formatCurrency(project.actualCost)}</td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    document.body.appendChild(tableContainer);

    try {
        // 3. Use html2canvas to take a "screenshot" of the table
        const canvas = await html2canvas(tableContainer, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
        });

        const imgData = canvas.toDataURL('image/png');
        
        // 4. Create a PDF and add the image to it
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('portfolio-report.pdf');

    } catch (error) {
        console.error("שגיאה ביצירת ה-PDF:", error);
        alert("אירעה שגיאה ביצירת קובץ ה-PDF.");
    } finally {
        // 5. Clean up by removing the temporary element
        document.body.removeChild(tableContainer);
    }
};

// --- שאר הפונקציות בקובץ נשארות זהות ---

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