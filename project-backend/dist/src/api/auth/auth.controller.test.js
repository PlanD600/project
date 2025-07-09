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
describe('POST /api/auth/register', () => {
    it('should return 400 for missing required fields', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(server_1.default)
            .post('/api/auth/register')
            .send({ email: 'test@example.com', password: 'password123' }); // missing fullName and companyName
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    }));
    it('should register a new user and organization', () => __awaiter(void 0, void 0, void 0, function* () {
        const uniqueEmail = `user${Date.now()}@example.com`;
        const res = yield (0, supertest_1.default)(server_1.default)
            .post('/api/auth/register')
            .send({
            fullName: 'Test User',
            email: uniqueEmail,
            password: 'password123',
            companyName: 'Test Company'
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('user');
        expect(res.body).toHaveProperty('organization');
        expect(res.body).toHaveProperty('token');
    }));
});
