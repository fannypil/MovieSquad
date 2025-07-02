const axios= require('axios');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if(!TMDB_API_KEY) {
    console.error('Error: TMDB_API_KEY is not defined in .env');
}

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
            console.error('TMDB Search Error:', err.message);
            if(err.response && err.response.data){
                return res.status(err.response.status).json(err.response.data);
            }
            res.status(500).json({ error: 'Server Error while searching TMDB' });
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
        console.error('TMDB Details Error:', err.message);
        if(err.response && err.response.data){
            return res.status(err.response.status).json(err.response.data);
        }
        res.status(500).json({ error: 'Server Error while fetching TMDB details' });
    }
}

//Get trending movies/tv shows

exports.getTmdbTrending = async (req, res) =>{
    const { type = 'movie', time_window = 'week' } = req.query;
     if(!['movie', 'tv'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be "movie" or "tv".' });
    }
    if(!['day', 'week'].includes(time_window)) {
        return res.status(400).json({ error: 'Invalid time window. Must be "day" or "week".' });
    }
    try{
        const response = await axios.get(`${TMDB_BASE_URL}/trending/${type}/${time_window}`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });
        res.json(response.data);
    }catch(err){
        console.error('TMDB Trending Error:', err.message);
        if(err.response && err.response.data){
            return res.status(err.response.status).json(err.response.data);
        }
        res.status(500).json({ error: 'Server Error while fetching TMDB trending' });
    }

}
