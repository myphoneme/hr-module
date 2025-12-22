import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/auth';
import db from '../db';
import type { User, Todo, TodoWithUsers } from '../types';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Define tools for task operations (OpenAI format)
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List tasks/todos. Can filter by status (pending, completed, all) or get tasks assigned to or created by the current user.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'pending', 'completed', 'my_tasks', 'assigned_to_me', 'created_by_me'],
            description: 'Filter for tasks. "my_tasks" returns tasks assigned to the user, "assigned_to_me" is the same, "created_by_me" returns tasks the user created.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return. Default is 10.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task/todo. Requires a title and assignee. The current user will be the assigner.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The title of the task',
          },
          description: {
            type: 'string',
            description: 'Detailed description of the task',
          },
          assignee: {
            type: 'string',
            description: 'Name or email of the user to assign the task to. If not provided, assigns to current user.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level of the task. Default is medium.',
          },
          due_date: {
            type: 'string',
            description: 'Due date/deadline for the task in ISO format (e.g., "2024-01-15T18:00:00"). Can also accept natural language like "6 PM today" which should be converted to ISO format.',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as completed by its ID or title',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'number',
            description: 'The ID of the task to complete',
          },
          task_title: {
            type: 'string',
            description: 'The title of the task to complete (will match partially)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task_summary',
      description: 'Get a summary of tasks including counts by status, priority, and recent activity',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_users',
      description: 'List all users in the system. Useful for finding who to assign tasks to.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tasks',
      description: 'Search for tasks by keyword in title or description',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find in task titles or descriptions',
          },
        },
        required: ['query'],
      },
    },
  },
];

// Tool execution functions
function executeListTasks(userId: number, args: { filter?: string; limit?: number }) {
  const limit = args.limit || 10;
  let query = `
    SELECT t.*,
           assigner.name as assignerName, assigner.email as assignerEmail,
           assignee.name as assigneeName, assignee.email as assigneeEmail
    FROM todos t
    JOIN users assigner ON t.assignerId = assigner.id
    JOIN users assignee ON t.assigneeId = assignee.id
  `;

  const params: (number | string)[] = [];

  switch (args.filter) {
    case 'pending':
      query += ' WHERE t.completed = 0';
      break;
    case 'completed':
      query += ' WHERE t.completed = 1';
      break;
    case 'my_tasks':
    case 'assigned_to_me':
      query += ' WHERE t.assigneeId = ?';
      params.push(userId);
      break;
    case 'created_by_me':
      query += ' WHERE t.assignerId = ?';
      params.push(userId);
      break;
    default:
      // all tasks
      break;
  }

  query += ' ORDER BY t.createdAt DESC LIMIT ?';
  params.push(limit);

  const tasks = db.prepare(query).all(...params) as TodoWithUsers[];
  return tasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.completed ? 'completed' : 'pending',
    priority: t.priority,
    assignedTo: t.assigneeName,
    createdBy: t.assignerName,
    createdAt: t.createdAt,
  }));
}

function executeCreateTask(userId: number, args: { title: string; description?: string; assignee?: string; priority?: string; due_date?: string }) {
  let assigneeId = userId;

  if (args.assignee) {
    // Search by email first, then by name (case-insensitive partial match)
    let assignee = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(args.assignee) as { id: number } | undefined;

    if (!assignee) {
      // Try matching by name (partial, case-insensitive)
      assignee = db.prepare('SELECT id FROM users WHERE LOWER(name) LIKE LOWER(?)').get(`%${args.assignee}%`) as { id: number } | undefined;
    }

    if (!assignee) {
      return { error: `User "${args.assignee}" not found. Use list_users to see available team members.` };
    }
    assigneeId = assignee.id;
  }

  const result = db.prepare(`
    INSERT INTO todos (title, description, assignerId, assigneeId, priority, dueDate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    args.title,
    args.description || '',
    userId,
    assigneeId,
    args.priority || 'medium',
    args.due_date || null
  );

  const task = db.prepare(`
    SELECT t.*, assignee.name as assigneeName
    FROM todos t
    JOIN users assignee ON t.assigneeId = assignee.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid) as Todo & { assigneeName: string };

  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      assignedTo: task.assigneeName,
      priority: task.priority,
      dueDate: task.dueDate,
    },
  };
}

function executeCompleteTask(userId: number, args: { task_id?: number; task_title?: string }) {
  let task: Todo | undefined;

  if (args.task_id) {
    task = db.prepare('SELECT * FROM todos WHERE id = ?').get(args.task_id) as Todo | undefined;
  } else if (args.task_title) {
    task = db.prepare('SELECT * FROM todos WHERE title LIKE ? AND completed = 0').get(`%${args.task_title}%`) as Todo | undefined;
  }

  if (!task) {
    return { error: 'Task not found' };
  }

  if (task.completed) {
    return { message: 'Task is already completed' };
  }

  db.prepare('UPDATE todos SET completed = 1, updatedAt = datetime("now") WHERE id = ?').run(task.id);

  return {
    success: true,
    message: `Task "${task.title}" marked as completed`,
  };
}

function executeGetTaskSummary(userId: number) {
  const totalTasks = db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number };
  const pendingTasks = db.prepare('SELECT COUNT(*) as count FROM todos WHERE completed = 0').get() as { count: number };
  const completedTasks = db.prepare('SELECT COUNT(*) as count FROM todos WHERE completed = 1').get() as { count: number };
  const myTasks = db.prepare('SELECT COUNT(*) as count FROM todos WHERE assigneeId = ? AND completed = 0').get(userId) as { count: number };

  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) as count
    FROM todos WHERE completed = 0
    GROUP BY priority
  `).all() as Array<{ priority: string; count: number }>;

  const recentTasks = db.prepare(`
    SELECT title, completed, createdAt
    FROM todos
    ORDER BY createdAt DESC
    LIMIT 5
  `).all() as Array<{ title: string; completed: number; createdAt: string }>;

  return {
    total: totalTasks.count,
    pending: pendingTasks.count,
    completed: completedTasks.count,
    myPendingTasks: myTasks.count,
    byPriority: byPriority.reduce((acc, p) => ({ ...acc, [p.priority]: p.count }), {}),
    recentTasks: recentTasks.map(t => ({
      title: t.title,
      status: t.completed ? 'completed' : 'pending',
      createdAt: t.createdAt,
    })),
  };
}

function executeListUsers() {
  const users = db.prepare('SELECT id, name, email, role FROM users WHERE isActive = 1').all() as Array<{ id: number; name: string; email: string; role: string }>;
  return users;
}

function executeSearchTasks(args: { query: string }) {
  const tasks = db.prepare(`
    SELECT t.id, t.title, t.description, t.completed, t.priority,
           assignee.name as assigneeName
    FROM todos t
    JOIN users assignee ON t.assigneeId = assignee.id
    WHERE t.title LIKE ? OR t.description LIKE ?
    ORDER BY t.createdAt DESC
    LIMIT 10
  `).all(`%${args.query}%`, `%${args.query}%`) as Array<any>;

  return tasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.completed ? 'completed' : 'pending',
    priority: t.priority,
    assignedTo: t.assigneeName,
  }));
}

// Process tool calls
function processToolCall(toolName: string, toolInput: any, userId: number): string {
  let result: any;

  switch (toolName) {
    case 'list_tasks':
      result = executeListTasks(userId, toolInput);
      break;
    case 'create_task':
      result = executeCreateTask(userId, toolInput);
      break;
    case 'complete_task':
      result = executeCompleteTask(userId, toolInput);
      break;
    case 'get_task_summary':
      result = executeGetTaskSummary(userId);
      break;
    case 'list_users':
      result = executeListUsers();
      break;
    case 'search_tasks':
      result = executeSearchTasks(toolInput);
      break;
    default:
      result = { error: `Unknown tool: ${toolName}` };
  }

  return JSON.stringify(result, null, 2);
}

// Chat endpoint
router.post('/chat', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { message, conversationHistory } = req.body;
  const userId = req.user!.userId;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'AI service not configured. Set OPENAI_API_KEY environment variable.' });
    return;
  }

  try {
    // Get current user info for context
    const user = db.prepare('SELECT name, email, role FROM users WHERE id = ?').get(userId) as User;

    const systemPrompt = `You are an AI assistant for Phoneme Workspace, a task management and team collaboration platform.

Current user information:
- Name: ${user.name}
- Email: ${user.email}
- Role: ${user.role}

You can help users with:
1. Managing tasks - creating, viewing, completing, and searching tasks
2. Getting task summaries and statistics
3. Finding team members to assign tasks to
4. Answering general questions about productivity and task management

When users ask about tasks, use the available tools to fetch real data from the system.
Be concise but helpful. If a task operation succeeds, confirm it clearly.
If there's an error, explain what went wrong and suggest alternatives.

Always be professional and friendly. Use the user's name occasionally to personalize responses.`;

    // Build messages array with conversation history
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    messages.push({
      role: 'user',
      content: message,
    });

    // Initial API call
    let response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages,
      tools,
      tool_choice: 'auto',
    });

    let assistantMessage = response.choices[0].message;

    // Process tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      messages.push(assistantMessage);

      // Process each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);
        const toolResult = processToolCall(toolName, toolInput, userId);

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Continue conversation with tool results
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages,
        tools,
        tool_choice: 'auto',
      });

      assistantMessage = response.choices[0].message;
    }

    res.json({
      response: assistantMessage.content || 'I apologize, but I could not generate a response.',
      usage: response.usage,
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'Failed to process AI request',
      details: error.message,
    });
  }
});

export default router;
