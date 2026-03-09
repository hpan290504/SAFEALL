export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { phone, channel, value } = req.body;

    if (!phone || !channel) return res.status(400).json({ message: 'Missing parameters' });

    console.log(`[OTP] Sending mock OTP to ${channel}: ${value} for phone ${phone}`);

    // In production, this would call Twilio or SendGrid
    // For now, we mock success. OTP is fixed to '123456' for testing.

    return res.status(200).json({
        success: true,
        message: `Mã OTP đã được gửi qua ${channel === 'email' ? 'Email' : 'Số điện thoại'} của bạn.`
    });
}
