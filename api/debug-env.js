export default function handler(req, res) {
    res.status(200).json({
        status: "alive",
        node: process.version,
        env: process.env.NODE_ENV,
        hasDb: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET
    });
};
