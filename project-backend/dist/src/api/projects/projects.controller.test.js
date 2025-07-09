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
const supertest_1 = __importDefault(require("supertest"));
const server_1 = __importDefault(require("../../../server"));
describe('POST /api/projects', () => {
    it('should return 400 for missing required fields', () => __awaiter(void 0, void 0, void 0, function* () {
        // Simulate an authenticated user (mock or use a test token if needed)
        const res = yield (0, supertest_1.default)(server_1.default)
            .post('/api/projects')
            .send({ name: '', description: '', startDate: '', endDate: '', budget: '' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    }));
    // Note: For a real test, you would need to authenticate and provide a valid token and organization context.
    // This is a scaffold; you may need to adjust for your auth middleware.
    it.skip('should create a new project (requires valid auth and org)', () => __awaiter(void 0, void 0, void 0, function* () {
        const token = 'YOUR_TEST_JWT_TOKEN'; // Replace with a real or mock token
        const res = yield (0, supertest_1.default)(server_1.default)
            .post('/api/projects')
            .set('Authorization', `Bearer ${token}`)
            .send({
            name: 'Test Project',
            description: 'A test project',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            budget: 10000
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('name', 'Test Project');
    }));
});
