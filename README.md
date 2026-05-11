# Data Processor Service

Asynchronous job processing service built with NestJS, RabbitMQ, Redis, and MongoDB.

## Tech Stack

- NestJS
- Redis
- MongoDB
- RabbitMQ (`amqplib`)
- Docker Compose

---

## Project Structure

```bash
├── src
│   ├── common
│   │   ├── common.utils.ts
│   │   ├── http-exception.filter.ts
│   │   └── response.interceptor.ts
│   │
│   ├── config
│   │   ├── database.config.ts
│   │   ├── queue.config.ts
│   │   └── redis.config.ts
│   │
│   ├── infrastructure
│   │   ├── mongodb.module.ts
│   │   ├── queueSetup.module.ts
│   │   └── redis.module.ts
│   │
│   ├── processor
│   │   ├── constants
│   │   ├── consumers
│   │   ├── controller
│   │   │   └── dataProcessor.controller.ts
│   │   ├── dto
│   │   ├── services
│   │   │   └── dataProcessor.service.ts
│   │   └── processor.module.ts
│   │
│   ├── queueUtils
│   │
│   └── app.module.ts
│
├── .dockerignore
├── .env
├── .env.example
├── docker-compose.yml
├── main.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

# Setup

## Option 1: Run with Docker (Recommended)

### Clone Repository

```bash
git clone https://github.com/ayushi0928/NestJsDataProcessing.git
cd NestJsDataProcessing
```

### Configure Environment

```bash
cp .env.example .env
```

### Start Services

```bash
docker compose up -d --build
```

---

## Useful Docker Commands

```bash
# Follow application logs
docker compose logs -f app

# Check container status
docker compose ps

# Restart only the app
docker compose restart app

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

Application will be available at:

```bash
http://localhost:8080
```

---

# Option 2: Local Environment Setup

Use this setup when MongoDB, Redis, and RabbitMQ are already installed and running on your local machine.

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment

```bash
cp .env.example .env
```

Example Local `.env`

```env
PORT=8080

# MongoDB
MONGO_URL=mongodb://localhost:27017/dataProcessor

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672


# Queue Config
QUEUE_PREFETCH=10
```

---

## Verify Local Services

Ensure the following services are already running locally:

| Service  | Default Port |
| -------- | ------------ |
| MongoDB  | `27017`      |
| Redis    | `6379`       |
| RabbitMQ | `5672`       |

Optional RabbitMQ Management UI:

```text
http://localhost:15672
```

Default RabbitMQ Credentials:

```text
username: guest
password: guest
```

---

## Build Application

```bash
npm run build
```

---

## Run Application

```bash
npm start
```

---

# PM2 Setup (Optional)

## Install PM2

```bash
npm install -g pm2
```

---

## Start Application Using PM2

```bash
pm2 start npm --name data-processor -- start
```

---

## View Logs

```bash
pm2 logs data-processor
```

---

## Restart Application

```bash
pm2 restart data-processor
```

---

## Stop Application

```bash
pm2 stop data-processor
```

---

# Common Validation Commands

## Check MongoDB Connection

```bash
mongosh
```

---

## Check Redis Connection

```bash
redis-cli ping
```

Expected response:

```text
PONG
```

---

## Check RabbitMQ Status

```bash
rabbitmqctl status
```

---

# Notes

- Docker is not required for local setup
- Application connects directly to locally running MongoDB, Redis, and RabbitMQ services
- Build step generates compiled files inside `dist/`
- Application starts using:

```bash
node dist/main.js
```

through:

```bash
npm start
```

## Check MongoDB Connection

```bash
mongosh
```

---

## Check Redis Connection

```bash
redis-cli ping
```

Expected response:

```text
PONG
```

---

## Check RabbitMQ Status

```bash
rabbitmqctl status
```

---

# Notes

- Docker is not required in this deployment mode
- Application directly connects to external MongoDB, Redis, and RabbitMQ servers
- Ensure network/firewall access is enabled between application server and dependent services
- Update `.env` values according to production infrastructure
- PM2 is recommended for process monitoring and automatic restart handling

---

# How It Works

## Request Flow

When calling:

```http
POST /process
```

The system performs the following:

1. Creates a new record in `processingRequestData`
   with status:

```text
in_progress
```

2. Generates a unique `requestId`

3. Publishes **1000 messages** to RabbitMQ

---

# Consumer Flow

Each consumer:

- Picks messages from RabbitMQ
- Performs:
  - Fibonacci computation
  - Base64 transformation
  - SHA-256 hash generation

### On Success

- Result is stored in Redis using `requestId`

### On Failure

- Message is pushed to retry queue

---

# Retry Consumer Flow

Retry consumer:

- Re-processes failed jobs
- Updates retry counts and success counts

### If Retry Succeeds

- Updates main request document

### If Retry Fails Again

- Stores failure details in:

```text
retryDataJson
```

---

# Completion Flow

Once all jobs are processed:

- Redis data is merged into the main request document
- Status is updated to:
  - `completed`
  - or `completed_with_errors`
- Redis keys are cleaned up

---

# API Endpoints

| Method | Endpoint       | Description                           |
| ------ | -------------- | ------------------------------------- |
| GET    | `/healthCheck` | Health check and consumer status      |
| POST   | `/process`     | Start processing 1000 records         |
| GET    | `/status`      | Overall statistics and progress state |

---

# Example Response

## `POST /process`

```json
{
  "responseCode": "200",
  "responseMessage": "Success",
  "responseFrom": "DataProcessorController",
  "responseTime": "5/11/2026, 12:51:17 AM",
  "responseData": {
    "_id": "6a0127f9cebde8524166ba5d",
    "requestId": "1c8a64d7-7abf-46de-a4ad-584d9633f42c",
    "urn": "1234556",
    "statusName": "COMPLETED",
    "status": 1,
    "totalCount": 1000,
    "success": 1000,
    "failed": 0,
    "completed": 1000,
    "createdOn": "2026-05-11T00:51:05.514Z",
    "updatedOn": "2026-05-11T00:51:06.033Z",
    "source": "final"
  }
}
```

---

# MongoDB Collections

## `processingRequestData`

Stores:

- Batch tracking
- Processing status
- Counts
- Final aggregated result

---

## `retryDataJn`

Stores:

- Failed records
- Error details

---

# Recommended Indexes

```javascript
// processingRequestData
db.processingRequestData.createIndex({ requestId: 1 }, { unique: true });

db.processingRequestData.createIndex({ status: 1 });

db.processingRequestData.createIndex({ createdAt: -1 });
```

---

# Environment Variables

| Variable         | Description                        |
| ---------------- | ---------------------------------- |
| `PORT`           | HTTP server port (default: 8080)   |
| `RABBITMQ_URL`   | RabbitMQ connection string         |
| `QUEUE_PREFETCH` | Queue prefetch count (default: 10) |

---

# Code Specific Variables

# Queue Names

QUEUE_DATA_PROCESSOR=data_processor_queue
QUEUE_DEAD_LETTER=data_processor_dlq

---

# Notes

- Uses asynchronous queue-based architecture
- Supports retry and dead-letter mechanisms
- Redis is used for temporary aggregation/state tracking
- MongoDB stores final processing metadata
- Designed for scalable batch processing workloads
