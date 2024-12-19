#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLIENT_ID = process.env.LEGIFRANCE_CLIENT_ID;
const CLIENT_SECRET = process.env.LEGIFRANCE_CLIENT_SECRET;
const OAUTH_TOKEN_URL = process.env.OAUTH_TOKEN_URL;
const API_URL = process.env.LEGIFRANCE_API_URL;
const API_KEY = process.env.LEGIFRANCE_API_KEY;
const OAUTH_SECRET = process.env.LEGIFRANCE_OAUTH_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET || !OAUTH_TOKEN_URL || !API_URL || !API_KEY || !OAUTH_SECRET) {
  throw new Error(
    'Missing required environment variables: LEGIFRANCE_CLIENT_ID, LEGIFRANCE_CLIENT_SECRET, OAUTH_TOKEN_URL, LEGIFRANCE_API_URL, LEGIFRANCE_API_KEY'
  );
}

const server = new Server(
  {
    name: 'legifrance-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {
        listChanged: false
      },
    },
  }
);

let accessToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (accessToken) {
    return accessToken;
  }

  try {
    // Since we've validated these values exist above, we can safely assert they're defined
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'openid'
    });

    // Create base64 encoded credentials for Basic auth
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');


    // Log full request details for debugging
    console.error(JSON.stringify({
      type: 'oauth_request_details',
      url: OAUTH_TOKEN_URL,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'X-Api-Key': API_KEY!,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json'
      },
      body: params.toString()
    }, null, 2));

    console.error(JSON.stringify({
      type: 'oauth_request',
      url: OAUTH_TOKEN_URL,
      params: Object.fromEntries(params)
    }));

    console.error('Attempting OAuth token request...');
    const response = await axios.post(OAUTH_TOKEN_URL!, params, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'X-Api-Key': API_KEY!,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept': 'application/json'
      }
    });

    console.error(JSON.stringify({
      type: 'oauth_debug',
      request: {
        url: OAUTH_TOKEN_URL,
        grant_type: params.get('grant_type'),
        scope: params.get('scope')
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        has_token: !!response.data?.access_token
      }
    }, null, 2));

    accessToken = response.data.access_token;
    if (!accessToken) {
      throw new Error('No access token received');
    }
    return accessToken;
  } catch (error) {
    console.error(JSON.stringify({
      type: 'oauth_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof AxiosError ? {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      } : undefined
    }));
    throw new McpError(ErrorCode.InternalError, 'Failed to get access token');
  }
}

async function loadOpenApiSpec() {
  try {
    const specPath = join(__dirname, 'specs', 'legifrance.json');
    const specContent = await readFile(specPath, 'utf-8');
    return JSON.parse(specContent) as {
      paths: Record<string, Record<string, {
        operationId: string;
        summary: string;
        parameters?: Array<{
          in: string;
          name: string;
          required?: boolean;
          schema: any;
        }>;
      }>>;
    };
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    throw new McpError(ErrorCode.InternalError, 'Failed to load OpenAPI specification');
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "searchLegifrance",
        description: "Search Legifrance documents",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            }
          },
          required: ["query"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "searchLegifrance") {
    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
  }

  try {
    if (!request.params.arguments || typeof request.params.arguments.query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid query parameter');
    }

    const token = await getAccessToken();
    const searchRequest = {
      fond: "JURI",
      recherche: {
        pageSize: 10,
        pageNumber: 1,
        sort: "SIGNATURE_DATE_DESC",
        typePagination: "DEFAUT",
        champs: [
          {
            typeChamp: "ALL",
            operateur: "ET",
            criteres: [
              {
                typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP",
                valeur: request.params.arguments.query,
                operateur: "ET"
              }
            ]
          }
        ],
        operateur: "ET"
      }
    };

    console.error(JSON.stringify({
      type: 'api_debug',
      request: {
        url: `${API_URL}/search`,
        has_token: !!token,
        has_api_key: !!API_KEY
      }
    }));

    const response = await axios.post(
      `${API_URL}/search`,
      searchRequest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Api-Key': API_KEY!,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Legifrance-MCP-Server/1.0'
        },
        validateStatus: null // Allow non-2xx responses for better error handling
      }
    );

    if (response.status !== 200) {
      console.error(JSON.stringify({
        type: 'api_error',
        status: response.status,
        statusText: response.statusText,
        data: response.data
      }));
      throw new Error(`API returned status ${response.status}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(response.data) }],
    };
  } catch (error) {
    console.error(JSON.stringify({
      type: 'api_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof AxiosError ? {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      } : undefined
    }));
    throw new McpError(ErrorCode.InternalError, 'Failed to call Legifrance API');
  }
});

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Legifrance MCP server running on stdio');
    
    // Test the connection immediately
    await getAccessToken();
    console.error('Successfully authenticated with Legifrance API');
  } catch (error) {
    console.error('Failed to start Legifrance MCP server:', error instanceof Error ? error.message : error);
    if (error instanceof AxiosError) {
      console.error('API Response:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
    process.exit(1);
  }
}

main();
