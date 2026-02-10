import { Request, Response } from 'express';
import { db } from './db';
import { leads } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface FacebookLeadData {
  id: string;
  created_time: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

interface FacebookWebhookEntry {
  id: string;
  time: number;
  changes: Array<{
    value: {
      leadgen_id: string;
      page_id: string;
      form_id: string;
      adgroup_id?: string;
      ad_id?: string;
      created_time: number;
    };
    field: string;
  }>;
}

interface FacebookWebhookPayload {
  object: string;
  entry: FacebookWebhookEntry[];
}

// Helper function to extract field value from Facebook lead data
function getFieldValue(fieldData: FacebookLeadData['field_data'], fieldName: string): string | undefined {
  const field = fieldData.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
  return field?.values?.[0];
}

// Fetch lead details from Facebook Graph API
async function fetchFacebookLeadDetails(leadId: string): Promise<FacebookLeadData | null> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('FACEBOOK_ACCESS_TOKEN not configured');
    return null;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${leadId}?access_token=${accessToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Facebook API error:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Facebook lead:', error);
    return null;
  }
}

// Validate webhook signature from Facebook
function validateFacebookSignature(req: Request): boolean {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!signature || !appSecret) {
      console.error('Missing signature or app secret');
      return false;
    }

    // Facebook sends signature as "sha256=<hash>"
    if (!signature.startsWith('sha256=')) {
      console.error('Invalid signature format');
      return false;
    }

    const signatureHash = signature.substring(7); // Remove "sha256=" prefix

    if (!signatureHash || signatureHash.length === 0) {
      console.error('Empty signature hash');
      return false;
    }

    // Calculate expected signature using the request body
    // IMPORTANT: This uses JSON.stringify which may not match Facebook's exact formatting
    // For production, Facebook webhooks should use express.raw() middleware to capture
    // the raw body before JSON parsing. This current implementation works for most cases
    // but may have edge cases with whitespace differences.
    const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedHash = crypto
      .createHmac('sha256', appSecret)
      .update(bodyString)
      .digest('hex');

    // Validate hash length before comparison
    if (signatureHash.length !== expectedHash.length) {
      console.error('Signature length mismatch');
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    console.error('Error validating Facebook signature:', error);
    return false;
  }
}

// Verify webhook request from Facebook
export function verifyFacebookWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Facebook webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('Facebook webhook verification failed');
    res.status(403).send('Forbidden');
  }
}

// Process incoming Facebook webhook
export async function processFacebookWebhook(req: Request, res: Response) {
  // Validate webhook signature
  if (!validateFacebookSignature(req)) {
    console.error('Invalid Facebook webhook signature');
    return res.status(403).send('Forbidden - Invalid signature');
  }

  const payload = req.body as FacebookWebhookPayload;

  console.log('Received Facebook webhook:', JSON.stringify(payload, null, 2));

  // Respond quickly to Facebook
  res.status(200).send('EVENT_RECEIVED');

  // Process the webhook asynchronously
  if (payload.object === 'page') {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'leadgen') {
          const leadgenId = change.value.leadgen_id;
          
          // Fetch full lead details from Facebook
          const leadData = await fetchFacebookLeadDetails(leadgenId);
          
          if (leadData) {
            await createLeadFromFacebook(leadData, change.value);
          }
        }
      }
    }
  }
}

// Create lead in database from Facebook lead data
async function createLeadFromFacebook(
  leadData: FacebookLeadData,
  webhookData: FacebookWebhookEntry['changes'][0]['value']
) {
  try {
    // Extract common fields from Facebook lead form
    const fullName = getFieldValue(leadData.field_data, 'full_name') || 
                     getFieldValue(leadData.field_data, 'name') || 
                     'Unknown';
    const firstName = getFieldValue(leadData.field_data, 'first_name');
    const lastName = getFieldValue(leadData.field_data, 'last_name');
    
    const name = firstName && lastName ? `${firstName} ${lastName}` : fullName;
    const phone = getFieldValue(leadData.field_data, 'phone_number') || 
                  getFieldValue(leadData.field_data, 'phone') || 
                  '';
    const email = getFieldValue(leadData.field_data, 'email');
    const budget = getFieldValue(leadData.field_data, 'budget');
    const location = getFieldValue(leadData.field_data, 'location') || 
                     getFieldValue(leadData.field_data, 'preferred_location');

    // Determine source (Facebook or Instagram based on ad data)
    const source = webhookData.ad_id?.includes('instagram') ? 'Instagram' : 'Facebook';

    // Check if lead already exists
    const existingLead = await db.query.leads.findFirst({
      where: eq(leads.externalId, leadData.id),
    });

    if (existingLead) {
      console.log('Lead already exists:', leadData.id);
      return;
    }

    // Create new lead
    await db.insert(leads).values({
      name,
      phone: phone || 'No phone provided',
      email: email || undefined,
      source,
      budget: budget ? budget : undefined,
      preferredLocation: location || undefined,
      stage: 'New',
      externalId: leadData.id,
      externalData: {
        platform: source,
        leadId: leadData.id,
        pageId: webhookData.page_id,
        formId: webhookData.form_id,
        adId: webhookData.ad_id,
        adgroupId: webhookData.adgroup_id,
        createdTime: leadData.created_time,
        rawData: leadData.field_data,
      },
    });

    console.log(`✅ Lead created from ${source}:`, name, phone);
  } catch (error) {
    console.error('Error creating lead from Facebook:', error);
  }
}
