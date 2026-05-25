const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Get token from request header
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token. Access denied.' });
  }

  try {
    // Verify the token is valid and not expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next(); // Continue to the actual route
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid.' });
  }
}

module.exports = authMiddleware;