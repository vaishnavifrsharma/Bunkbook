import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure Web Push with VAPID keys
webpush.setVapidDetails(
  'mailto:support@bunkbook.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// We use the service role key to bypass RLS in the cron job
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: Request) {
  try {
    // In a real cron environment, verify a secure cron secret here
    
    // For demonstration/testing, we accept a user_id to trigger a test push
    const { user_id, title, body } = await req.json().catch(() => ({ user_id: null, title: 'Class Reminder', body: 'Class in 10 min — mark attendance' }));

    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data: subscriptions, error } = await query;

    if (error || !subscriptions) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }

    const payload = JSON.stringify({
      title: title || 'Class in 10 min',
      body: body || 'Tap to mark your attendance.',
      url: '/dashboard'
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('Push error for sub', sub.id, err);
        }
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
