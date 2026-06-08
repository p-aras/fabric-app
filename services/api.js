import axios from "axios";

const API = axios.create({
  baseURL: "https://new-fabric-backend-1.onrender.com"
});

export default API;