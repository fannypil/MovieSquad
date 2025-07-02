const jwt = require('jsonwebtoken');

//Middleware function to protect routes
module.exports= function(req, res, next){
    console.log('All headers:', req.headers); // Debug line
    // Get token from the request header
    const token = req.header('x-auth-token');
    console.log('Token received:', token); // Debug line

    // Check if no token
    if(!token){
        return res.status(401).json({msg: 'No token, authorization denied'});
    }
    // Verify token
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; 
        next(); 
    }catch(err){
        // If verification fails (e.g., token is expired or invalid)
        res.status(401).json({msg: 'Token is not valid'});
    }
}