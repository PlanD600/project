"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinancialSummary = exports.addFinancialEntry = void 0;
const db_1 = __importDefault(require("../../db"));
const logger_1 = __importDefault(require("../../logger"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const createFinanceSchema = zod_1.z.object({
    type: zod_1.z.enum(['Income', 'Expense']),
    amount: zod_1.z.preprocess(val => typeof val === 'string' ? parseFloat(val) : val, zod_1.z.number().min(0, 'Amount must be non-negative')),
    description: zod_1.z.string().optional(),
    date: zod_1.z.string().min(1, 'Date is required'),
    projectId: zod_1.z.string().min(1, 'Project ID is required'),
    source: zod_1.z.string().min(1, 'Source is required'),
});
const addFinancialEntry = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = createFinanceSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }
    const { type, amount, description, date, projectId, source } = parsed.data;
    const user = req.user;
    if (!user || !user.activeOrganizationId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!type || !amount || !date || !projectId || !source) {
        logger_1.default.warn({ message: 'Attempt to add financial entry failed: Missing required data.', context: { userId: user.id, body: req.body } });
        return res.status(400).json({ message: 'Missing required financial data.' });
    }
    // כלל #2: שימוש ב-enum במקום טקסט
    // Find membership for active org
    const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    if (type === 'Income' && role !== client_1.UserRole.ORG_ADMIN) {
        logger_1.default.warn({ message: 'Unauthorized attempt to add income entry.', context: { userId: user.id, role } });
        return res.status(403).json({ message: 'Not authorized to add income entries.' });
    }
    try {
        // כלל #1: ודא שהפרויקט שאליו אתה מוסיף רשומה שייך לארגון שלך
        const project = yield db_1.default.project.findFirst({
            where: { id: projectId, organizationId: user.activeOrganizationId }
        });
        if (!project) {
            logger_1.default.warn({ message: 'Add financial entry failed: Project not found in organization.', projectId, userId: user.id, orgId: user.activeOrganizationId });
            return res.status(404).json({ message: 'Project not found.' });
        }
        const newEntry = yield db_1.default.financialTransaction.create({
            data: {
                type,
                amount, // already a number from zod
                description,
                date: new Date(date),
                source,
                projectId,
                organizationId: user.activeOrganizationId // כלל #1: שייך את הרשומה החדשה לארגון
            }
        });
        logger_1.default.info({ message: 'Financial entry added successfully.', entryId: newEntry.id, userId: user.id, projectId });
        res.status(201).json(newEntry);
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to add financial entry.', context: { body: req.body, userId: user.id }, error });
        next(error);
    }
});
exports.addFinancialEntry = addFinancialEntry;
const getFinancialSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { team_id } = req.query;
    if (!user || !user.activeOrganizationId) {
        logger_1.default.warn({ message: 'Unauthorized attempt to get financial summary: No user or org in request.' });
        return res.status(401).json({ message: 'Not authorized' });
    }
    try {
        // Find membership for active org
        const membership = user.memberships.find(m => m.organizationId === user.activeOrganizationId);
        const role = membership === null || membership === void 0 ? void 0 : membership.role;
        logger_1.default.info({ message: 'Attempting to get financial summary.', userId: user.id, role, orgId: user.activeOrganizationId, team_id_filter: team_id });
        // כלל #2: שימוש ב-enum
        if (role === client_1.UserRole.ORG_ADMIN) {
            // כלל #1: כל השאילתות מתייחסות רק לארגון של המשתמש
            let whereClause = { memberships: { some: { organizationId: user.activeOrganizationId } } };
            if (team_id) {
                // כלל #1: ודא שהצוות שייך לארגון שלך
                const projectsInTeam = yield db_1.default.project.findMany({
                    where: { teamId: team_id, organizationId: user.activeOrganizationId },
                    select: { id: true }
                });
                const projectIds = projectsInTeam.map((p) => p.id);
                whereClause.projectId = { in: projectIds };
                logger_1.default.info({ message: 'Admin filtering financial summary by team projects.', teamId: team_id, projectIdsCount: projectIds.length });
            }
            const totalIncomeResult = yield db_1.default.financialTransaction.aggregate({
                _sum: { amount: true },
                where: Object.assign(Object.assign({}, whereClause), { type: 'Income' })
            });
            const totalExpenseResult = yield db_1.default.financialTransaction.aggregate({
                _sum: { amount: true },
                where: Object.assign(Object.assign({}, whereClause), { type: 'Expense' })
            });
            logger_1.default.info({ message: 'Admin financial summary fetched successfully.', totalIncome: totalIncomeResult._sum.amount, totalExpense: totalExpenseResult._sum.amount });
            res.json({
                totalIncome: totalIncomeResult._sum.amount || 0,
                totalExpense: totalExpenseResult._sum.amount || 0,
            });
        }
        else if (role === client_1.UserRole.TEAM_LEADER) {
            // TODO: Implement logic to fetch projects for teams this user leads in this org
            // Currently, user.teamId is not available. Implement team lookup via memberships or another method if needed.
            res.status(403).json({ message: 'Not authorized to view financial summary (team context not implemented)' });
        }
        else {
            logger_1.default.warn({ message: 'User not authorized to view financial summary.', userId: user.id, role });
            res.status(403).json({ message: 'Not authorized to view financial summary' });
        }
    }
    catch (error) {
        logger_1.default.error({ message: 'Failed to get financial summary.', context: { query: req.query, userId: user === null || user === void 0 ? void 0 : user.id }, error });
        next(error);
    }
});
exports.getFinancialSummary = getFinancialSummary;
