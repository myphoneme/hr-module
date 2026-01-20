
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import settingsRouter from './routes/settings';
import todosRouter from './routes/todos';
import commentsRouter from './routes/comments';
import notificationsRouter from './routes/notifications';
import aiRouter from './routes/ai';
import companiesRouter from './routes/companies';
import branchesRouter from './routes/branches';
import bankAccountsRouter from './routes/bankAccounts';
import projectsRouter from './routes/projects';
import vendorsRouter from './routes/vendors';
import employeesRouter from './routes/employees';
import transactionNatureRouter from './routes/transactionNature';
import categoryGroupRouter from './routes/categoryGroup';
import categoryRouter from './routes/category';
import offerLettersRouter from './routes/offerLetters';
import signatoriesRouter from './routes/signatories';
import companyLettersRouter from './routes/companyLetters';
import ragRouter from './routes/rag';
import letterheadsRouter from './routes/letterheads';
import recruitmentRouter from './routes/recruitment';
import gmailIntegrationRouter from './routes/gmailIntegration';
import calendarIntegrationRouter from './routes/calendarIntegration';
import emailTemplatesRouter from './routes/emailTemplates';
import emailDraftsRouter from './routes/emailDrafts';
import ctcDiscussionRouter from './routes/ctcDiscussion';
import automationWorkflowRouter from './routes/automationWorkflow';
import recruitmentWorkflowRouter from './routes/recruitmentWorkflow';
import { corsOrigins, serverBaseUrl, serverPort } from './config';

const app = express();
const PORT = serverPort;

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/todos', todosRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/bank-accounts', bankAccountsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/transaction-nature', transactionNatureRouter);
app.use('/api/category-group', categoryGroupRouter);
app.use('/api/category', categoryRouter);
app.use('/api/offer-letters', offerLettersRouter);
app.use('/api/signatories', signatoriesRouter);
app.use('/api/company-letters', companyLettersRouter);
app.use('/api/rag', ragRouter);
app.use('/api/letterheads', letterheadsRouter);
app.use('/api/recruitment', recruitmentRouter);
app.use('/api/gmail', gmailIntegrationRouter);
app.use('/api/calendar', calendarIntegrationRouter);
app.use('/api/email-templates', emailTemplatesRouter);
app.use('/api/email-drafts', emailDraftsRouter);
app.use('/api/ctc-discussions', ctcDiscussionRouter);
app.use('/api/automation', automationWorkflowRouter);
app.use('/api/recruitment-workflow', recruitmentWorkflowRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Server running on ${serverBaseUrl}`);
});
