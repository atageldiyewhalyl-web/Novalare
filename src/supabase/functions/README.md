# Supabase Server Setup

This directory contains the Supabase Hono server for the Novalare demo applications.

## Server Routes

The server runs at: `https://{projectId}.supabase.co/functions/v1/make-server-53c2e113/`

### Available Endpoints:

#### 1. Health Check
**GET** `/make-server-53c2e113/health`

Returns server status.

#### 2. 10-K Analysis
**POST** `/make-server-53c2e113/analyze-10k`

Analyzes 10-K financial filings using OpenAI GPT-4o and extracts key financial metrics.

**Extracts:**
- Revenue
- Cost of Sales (COGS)
- Research & Development (R&D)
- Selling, General & Administrative (SG&A)
- Company Name
- Fiscal Year

**Calculates:**
- Gross Profit
- Operating Profit (EBIT)
- Gross Margin %
- Operating Margin %

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: file (PDF of 10-K filing)
- Headers: Authorization: Bearer {ANON_KEY}

## Setup Instructions

### Prerequisites
1. Supabase CLI installed: `npm install -g supabase`
2. OpenAI API key

### Deployment Steps

1. **Login to Supabase**
   ```bash
   supabase login
   ```

2. **Link your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Set OpenAI API Key as a secret**
   ```bash
   supabase secrets set OPENAI_API_KEY=your-openai-api-key
   ```

4. **Deploy the server**
   ```bash
   supabase functions deploy server
   ```

### Testing Locally

1. **Create .env file** in `/supabase` directory:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```

2. **Serve the function locally**
   ```bash
   supabase functions serve server --env-file .env
   ```

3. **Test with curl**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/make-server-53c2e113/analyze-10k \
     -F "file=@path/to/your/10k.pdf" \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

## Environment Variables

Create a `.env.local` file in the `/supabase` directory:

```
OPENAI_API_KEY=sk-your-key-here
```

## API Response Format

```json
{
  "company_name": "Example Corp",
  "fiscal_year": "2023",
  "revenue": 1500.5,
  "cost_of_sales": 800.2,
  "research_and_development": 150.0,
  "selling_general_admin": 250.3,
  "gross_profit": 700.3,
  "operating_profit": 300.0,
  "gross_margin": 46.69,
  "operating_margin": 20.0
}
```

All financial values are in millions of dollars.

## CORS Configuration

The function includes CORS headers to allow requests from your frontend application. Make sure your frontend URL is allowed in production.

## Cost Considerations

- Each 10-K analysis uses GPT-4o
- Average cost per analysis: ~$0.05-0.15 (depending on document size)
- Consider implementing rate limiting for production use

## Security Notes

- Never commit API keys to version control
- Use Supabase secrets for sensitive data
- Consider adding authentication to the function
- Add rate limiting for production deployments
