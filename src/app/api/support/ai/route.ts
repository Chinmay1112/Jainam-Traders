import { NextRequest, NextResponse } from 'next/server';
import { executeAiSupportTool } from '@/lib/db/store-service';
import { CANONICAL_SHOP_CONFIG } from '@/lib/config/shop-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = String(body.message || '').trim().toLowerCase();

    // Security check: Block jailbreak attempts, prompt injection, and credential extraction (Part 24)
    const isInjectionAttempt =
      userMessage.includes('ignore previous') ||
      userMessage.includes('ignore your instructions') ||
      userMessage.includes('reveal system prompt') ||
      userMessage.includes('system prompt') ||
      userMessage.includes('database credential') ||
      userMessage.includes('show all customer') ||
      userMessage.includes('admin password') ||
      userMessage.includes('hidden inventory') ||
      userMessage.includes('reveal credentials') ||
      userMessage.includes('secret key') ||
      userMessage.includes('api key') ||
      userMessage.includes('service role');

    if (isInjectionAttempt) {
      return NextResponse.json({
        reply:
          'I am the virtual assistant for Jainam Traders. I am programmed to assist only with public product availability, store hours, location, pickup rules, and order status verification. Internal administrative information and personal customer data are strictly confidential.',
        escalateToHuman: false,
      });
    }

    // Deterministic tool dispatch based on customer intent
    let responseText = '';
    let escalateToHuman = false;

    if (
      userMessage.includes('dispute') ||
      userMessage.includes('complaint') ||
      userMessage.includes('human') ||
      userMessage.includes('agent') ||
      userMessage.includes('call manager')
    ) {
      escalateToHuman = true;
      responseText =
        `I've flagged your conversation for our store manager. You can also directly call our shop counter at ${CANONICAL_SHOP_CONFIG.phone} or chat with us on WhatsApp at ${CANONICAL_SHOP_CONFIG.whatsappNumber}.`;
    } else if (
      userMessage.includes('hour') ||
      userMessage.includes('time') ||
      userMessage.includes('open') ||
      userMessage.includes('close') ||
      userMessage.includes('where') ||
      userMessage.includes('address') ||
      userMessage.includes('location')
    ) {
      const dataStr = await executeAiSupportTool('get_shop_information', {});
      const info = JSON.parse(dataStr);
      responseText = `${CANONICAL_SHOP_CONFIG.shopName} is located at: ${info.address || CANONICAL_SHOP_CONFIG.shopAddress}.\nOur store timings are ${info.openingTime || CANONICAL_SHOP_CONFIG.openingTime} AM to ${info.closingTime || CANONICAL_SHOP_CONFIG.closingTime} PM (Closed on ${(info.weeklyClosedDays || CANONICAL_SHOP_CONFIG.weeklyClosedDays).join(', ')}).\nPickup Counter Instructions: ${info.pickupInstructions || CANONICAL_SHOP_CONFIG.pickupInstructions}`;
    } else if (userMessage.includes('return') || userMessage.includes('refund') || userMessage.includes('exchange')) {
      const policyStr = await executeAiSupportTool('get_return_policy', {});
      const policy = JSON.parse(policyStr);
      responseText = `${policy.policy}\nTo request a return for an order you picked up, visit your Orders page and tap "Request Return".`;
    } else if (userMessage.includes('order') && /jt-\d{4}-\d+/i.test(userMessage)) {
      const match = userMessage.match(/jt-\d{4}-\d+/i);
      const orderNumber = match ? match[0].toUpperCase() : '';
      const orderStr = await executeAiSupportTool('get_order_status', { orderNumber });
      const orderInfo = JSON.parse(orderStr);
      if (orderInfo.error) {
        responseText = `I could not find order number "${orderNumber}". Please double-check the Order ID shown in your confirmation email or order history.`;
      } else {
        responseText = `Order ${orderInfo.orderNumber} is currently: ${orderInfo.status}.\nTotal: ${orderInfo.totalAmount} (Payment Status: ${orderInfo.paymentStatus} at Counter).\nPickup Mode: ${orderInfo.pickupMode}.`;
      }
    } else if (
      userMessage.includes('price') ||
      userMessage.includes('stock') ||
      userMessage.includes('have') ||
      userMessage.includes('product') ||
      userMessage.includes('frame') ||
      userMessage.includes('clock') ||
      userMessage.includes('watch') ||
      userMessage.includes('perfume') ||
      userMessage.includes('toy') ||
      userMessage.includes('ganesha') ||
      userMessage.includes('pen')
    ) {
      // Extract search keyword
      const keyword = userMessage
        .replace(/(do you have|is there|what is the price of|show me|available|in stock|\?)/g, '')
        .trim();
      const resultsStr = await executeAiSupportTool('search_products', { query: keyword || 'gift' });
      const items = JSON.parse(resultsStr);

      if (items.length === 0) {
        responseText = CANONICAL_SHOP_CONFIG.whatsappNumber
          ? `I searched our live catalogue for "${keyword}", but did not find an exact match. Please check our Categories page or feel free to WhatsApp us directly at ${CANONICAL_SHOP_CONFIG.whatsappNumber}!`
          : `I searched our live catalogue for "${keyword}", but did not find an exact match. Please check our Categories page or visit our store counter for assistance!`;
      } else {
        const productList = items
          .map((i: { name: string; price: string; availability: string }) => `• ${i.name} - ${i.price} (${i.availability})`)
          .join('\n');
        responseText = `Here is the current live availability from Jainam Traders:\n\n${productList}\n\nYou can reserve any available item online and pay when picking up at the store!`;
      }
    } else {
      responseText =
        'Namaste! Welcome to Jainam Traders Support. I can help you check real-time product prices & availability, store location & opening hours, order status, or our return & pickup policies. How can I assist you today?';
    }

    return NextResponse.json({
      reply: responseText,
      escalateToHuman,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI support service error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
