// 使用KV存储来保存任务状态
let taskStore = {};

// 生成唯一的任务ID
function generateTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建新任务
function createTask() {
  const taskId = generateTaskId();
  taskStore[taskId] = {
    status: 'pending',
    result: null,
    error: null,
    timestamp: Date.now()
  };
  return taskId;
}

// 更新任务状态
function updateTask(taskId, status, result = null, error = null) {
  if (taskStore[taskId]) {
    taskStore[taskId] = {
      status,
      result,
      error,
      timestamp: Date.now()
    };
  }
}

// 获取任务状态
function getTask(taskId) {
  return taskStore[taskId];
}

// 清理过期任务（1小时后）
function cleanupTasks() {
  const now = Date.now();
  const expiryTime = 3600000; // 1小时（毫秒）
  
  Object.keys(taskStore).forEach(taskId => {
    if (now - taskStore[taskId].timestamp > expiryTime) {
      delete taskStore[taskId];
    }
  });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 定期清理过期任务
  cleanupTasks();

  if (pathname === '/task/status') {
    const taskId = url.searchParams.get('taskId');
    if (!taskId) {
      return new Response('Task ID is required', { status: 400 });
    }

    const task = getTask(taskId);
    if (!task) {
      return new Response('Task not found', { status: 404 });
    }

    return new Response(JSON.stringify(task), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  if (pathname === '/' || pathname === '/index.html') {
    return new Response('service is running!', {
      status: 200,
      headers: {
        'Content-Type': 'text/html'
      }
    });
  } 
  if(pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  const apiMapping = {
    '/discord': 'https://discord.com/api',
    '/telegram': 'https://api.telegram.org',
    '/openai': 'https://api.openai.com',
    '/claude': 'https://api.anthropic.com',
    '/gemini': 'https://generativelanguage.googleapis.com',
    '/meta': 'https://www.meta.ai/api',
    '/groq': 'https://api.groq.com',
    '/x': 'https://api.x.ai',
    '/cohere': 'https://api.cohere.ai',
    '/huggingface': 'https://api-inference.huggingface.co',
    '/together': 'https://api.together.xyz',
    '/novita': 'https://api.novita.ai',
    '/portkey': 'https://api.portkey.ai',
    '/fireworks': 'https://api.fireworks.ai',
    '/openrouter': 'https://openrouter.ai/api'
  }
  
  const [prefix, rest] = extractPrefixAndRest(pathname, Object.keys(apiMapping));
  if (prefix) {
    const baseApiUrl = apiMapping[prefix];
    const targetUrl = `${baseApiUrl}${rest}`;

    try {
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: new Headers(request.headers),
        body: request.body
      });

      // 创建新任务
      const taskId = createTask();

      // 异步处理请求
      (async () => {
        try {
          const response = await fetch(newRequest);
          const result = await response.json();
          updateTask(taskId, 'completed', result);
        } catch (error) {
          updateTask(taskId, 'failed', null, error.message);
        }
      })();

      // 立即返回任务ID
      return new Response(JSON.stringify({ taskId }), {
        status: 202,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Failed to fetch:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

function extractPrefixAndRest(pathname, prefixes) {
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return [prefix, pathname.slice(prefix.length)];
    }
  }
  return [null, null];
}