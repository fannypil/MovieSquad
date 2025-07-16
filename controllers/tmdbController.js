const axios= require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if(!TMDB_API_KEY) {
    console.error('Error: TMDB_API_KEY is not defined in .env');
}

// Helper function for common error handling
const handleTmdbError = (res, err, message) => {
    console.error(`${message}:`, err.message);
    if (err.response && err.response.data) {
        // Pass TMDB's specific error message and status if available
        return res.status(err.response.status).json(err.response.data);
    }
    res.status(500).json({ error: `Server Error while ${message.toLowerCase()}` });
};


// Search for movies and TV shows
exports.searchTmdb = async (req, res) => {
    //Default type to movie, page to 1
    const { query, type='movie', page = 1 } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    if(!['movie', 'tv','multi'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "movie", "tv", or "multi".' });
    }
    try{
        const response = await axios.get(`${TMDB_BASE_URL}/search/${type}`,{
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                page: page
            }
        });
        res.json(response.data);
        } catch (error) {
            handleTmdbError(res, err, 'searching TMDB');
        }
}

//Get details for a specific movie or TV show
exports.getTmdbDetails = async (req, res) =>{
    const {type, id}= req.params;

    if(!id || !type) {
        return res.status(400).json({ error: 'Media type and ID are required' });
    }
    if(!['movie', 'tv'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "movie" or "tv".' });
    }
    try{
        const response= await axios.get(`${TMDB_BASE_URL}/${type}/${id}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'videos,credits,images,recommendations'
            }
        });
        res.json(response.data);
    }catch (err) {
       handleTmdbError(res, err, 'fetching TMDB details');
    }
}

//Get trending movies/tv shows

exports.getTmdbTrending = async (req, res) =>{
    const { type = 'movie', time_window = 'week' } = req.query;
     if(!['movie', 'tv','all'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "movie" or "tv".' });
    }
    if(!['day', 'week'].includes(time_window)) {
        return res.status(400).json({ error: 'Invalid time window. Must be "day" or "week".' });
    }
    try{
        const tmdbType = type === 'all' ? 'all' : type;
        const response = await axios.get(`${TMDB_BASE_URL}/trending/${type}/${time_window}`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });
        res.json(response.data);
    }catch(err){
       handleTmdbError(res, err, 'fetching TMDB trending');
    }

}

// Discover movies or TV shows with advanced filtering , GET /api/tmdb/discover
exports.discoverTmdb = async (req, res)=>{
    const{
        type= 'movie', //'movie' or 'tv'
        page=1,
        sort_by='popularity.desc', // e.g., 'popularity.desc', 'vote_average.desc', 'release_date.desc'
        with_genres,
        primary_release_year, //movies
        first_air_date_year, // tv
        vote_average_gte,
        vote_count_gte,
        query 
    }=req.query

    if(!['movie', 'tv'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "movie" or "tv".' });
    }

    let tmdbPath= `/discover/${type}`;
    const params={
        api_key: TMDB_API_KEY,
        page: page,
        sort_by: sort_by
    }

    if (with_genres) {
        params.with_genres = with_genres;
    }
    if (type === 'movie' && primary_release_year) {
        params.primary_release_year = primary_release_year;
    }
    if (type === 'tv' && first_air_date_year) {
        params.first_air_date_year = first_air_date_year;
    }
    if (vote_average_gte) {
        params['vote_average.gte'] = vote_average_gte; // Note the dot notation for TMDB
    }
    if (vote_count_gte) {
        params['vote_count.gte'] = vote_count_gte;
    }
    // More discover params can be added here..

    try{
        const response = await axios.get(`${TMDB_BASE_URL}${tmdbPath}`, { params });
        res.json(response.data)
    }catch(err){
        handleTmdbError(res, err, `discovering ${type} content`);
    }
}

// Get videos (trailers) for a specific movie
exports.getTmdbVideos = async (req, res) => {
    console.log('getTmdbVideos called'); // Add this line
    const { movieId } = req.params;
    let { type } = req.query;
    console.log('movieId:', movieId, 'type:', type); // Debug log
    console.log('movieId:', movieId, 'type:', type, 'req.query:', req.query);
    // Sanitize type
    if (type) type = type.trim().toLowerCase();

    if (!movieId || !type || !["movie", "tv"].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "movie" or "tv".' });
    }
    try {
        const endpoint =
            type === "movie"
                ? `https://api.themoviedb.org/3/movie/${movieId}/videos`
                : `https://api.themoviedb.org/3/tv/${movieId}/videos`;

        const response = await axios.get(endpoint, {
            params: { api_key: process.env.TMDB_API_KEY }
        });
        const videos = response.data.results || [];
        const trailer = videos.find(
            v => v.type === "Trailer" && v.site === "YouTube"
        );
        res.json({
            trailer: trailer || null,
            videos
        });
    } catch (err) {
        console.error("Error fetching TMDB videos:", err.message);
        res.status(500).json({ error: "Failed to fetch trailer info" });
    }
};

