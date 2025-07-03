const jwt = require('jsonwebtoken');

//Middleware function to protect routes
module.exports = function(req, res, next){
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('All headers:', req.headers);
    
    const token = req.header('x-auth-token');
    console.log('Token received:', token);
    console.log('Token type:', typeof token);
    console.log('Token length:', token ? token.length : 'N/A');

    if(!token){
        console.log('❌ No token found');
        return res.status(401).json({msg: 'No token, authorization denied'});
    }
    
    try{
        console.log('🔑 Verifying token...');
        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token decoded successfully:', decoded);
        
        req.user = decoded.user; 
        console.log('✅ req.user set to:', req.user);
        
        next(); 
    }catch(err){
        console.log('❌ Token verification failed:', err.message);
        res.status(401).json({msg: 'Token is not valid'});
    }
}