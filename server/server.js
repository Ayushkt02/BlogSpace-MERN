import express from 'express'
import mongoose from 'mongoose';
import 'dotenv/config'
import bcrypt from 'bcrypt'
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import admin from "firebase-admin"
import serviceAccountKey from "./blogging-website-4065b-firebase-adminsdk-wk7aa-f0110c1762.json" assert {type: "json"}
import { getAuth } from "firebase-admin/auth"
import { getStorage, ref, getDownloadURL } from "firebase/storage";

import { initializeApp } from "firebase/app";

const firebaseConfig = {
    apiKey: "AIzaSyDVIIv4HU4Shc2Jb8ktgD8K7geAhCkIzO0",
    authDomain: "blogging-website-4065b.firebaseapp.com",
    projectId: "blogging-website-4065b",
    storageBucket: "blogging-website-4065b.appspot.com",
    messagingSenderId: "623226614203",
    appId: "1:623226614203:web:e80505769684842375549e",
};

const app = initializeApp(firebaseConfig);

import User from './Schema/User.js';
import Blog from './Schema/Blog.js';
import Notification from './Schema/Notification.js';
import Comment from './Schema/Comment.js';

const storage = getStorage(app);

const server = express();
let PORT = 3000;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey)
})

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password

server.use(express.json())
server.use(cors());

mongoose.connect(process.env.DB_LOCATION, {
    autoIndex: true
})

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];

    if(token == null){
        return res.status(401).json({ error: "No access token" });
    }
    
    jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user) => {
        if(err){
            return res.status(403).json({ error: "Access token is invalid" })
        }
        req.user = user.id;
        next();
    })
}

const formatDatatoSend = (user) => {
    const access_token = jwt.sign({ id: user._id }, process.env.SECRET_ACCESS_KEY)

    return {
        access_token,
        profile_img: user.personal_info.profile_img,
        username: user.personal_info.username,
        fullname: user.personal_info.fullname
    }
}

const generateUsername = async (email) => {
    let username = email.split("@")[0];
    let isUsernameUnique = await User.exists({"personal_info.username": username}).then((res) => res)

    isUsernameUnique ? username+= nanoid().substring(0, 5) : "";
    return username;
}

server.post("/signup", (req, res) => {
    let { fullname, email, password } = req.body;

    if(fullname.length < 3){
        return res.status(403).json({ "error" : "FullName must be atleast 3 letters long" })
    }
    if(email.length==0){
        return res.status(403).json({ "error": "Enter Email" })
    }
    if(!emailRegex.test(email)){
        return res.status(403).json({ "error": "Email is invalid"})
    }
    if(!passwordRegex.test(password)){
        return res.status(403).json({ "error": "password should be 6 to 20 character long with a numeric, 1 lowercase and 1 uppercase"})
    }

    bcrypt.hash(password, 10, async (err, hashed_password)=>{
        let username = await generateUsername(email);

        let user = new User({
            personal_info: { fullname, email, password: hashed_password, username }
        })

        user.save().then((u) => {
            return res.status(200).json(formatDatatoSend(u));
        })
        .catch((err) => {
            if(err.code == 11000){
                return res.status(500).json({"error": "Email already exists"});
            }
            return res.status(500).json({"error": err.message})
        })
    })
})

server.post("/signin", (req, res)=>{
    let { email, password } = req.body;

    User.findOne({ "personal_info.email": email })
    .then((user) => {
        if(!user){
            return res.status(403).json({ "error": "email not found" })
        }
        if(!user.google_auth){
            bcrypt.compare(password, user.personal_info.password, (err, result) => {
                if(err){
                    return res.status(403).json({ "error": "Error occured while login please try again" })
                }
    
                if(!result){
                    return res.status(403).json({ "error": "incorrect password" })
                }else{
                    return res.status(200).json(formatDatatoSend(user));
                }
            })
        }else{
            return res.status(403).json({"error": "Account logged in using google. Try logging in using google"})
        }
    })
    .catch((err)=>{
        console.log(err.message);
        return res.status(500).json({ "error": err.message })
    })
})

server.post("/google-auth", async (req, res) => {
    let { access_token } = req.body;
    
    await getAuth().verifyIdToken(access_token)
    .then(async (decodedUser)=>{
        let { email, name, picture } = decodedUser;
        picture = picture.replace("s96-c", "s384-c");
        let user = await User.findOne({"personal_info.email": email}).select("personal_info.fullname personal_info.username personal_info.profile_img google_auth")
        .then((u) => {
            return u || null;
        })
        .catch((err) => {
            return res.status(500).json({"error": err.message});
        })

        if(user){
            if(!user.google_auth){
                return res.status(403).json({"error": "This email was signed up without google. please log in with password to access the account"})
            }
        }else{
            let username = await generateUsername(email);

            user = new User({
                personal_info: { fullname: name, email, username },
                google_auth: true
            })

            await user.save().then((u)=>{
                user = u;
            })
            .catch(err => {
                return res.status(500).json({ "error": err.message });
            })
        }
        return res.status(200).json(formatDatatoSend(user));
    })
    .catch(err => {
        return res.status(500).json( {"error": "Failed to authenticate you with google. Try with some other google account"} )
    })
})

server.post("/change-password", verifyJWT, (req, res)=>{
    let { currentPassword, newPassword } = req.body;

    if(!passwordRegex.test(currentPassword) || !passwordRegex.test(newPassword)){
        return res.status(403).json({ error: "password should be 6 to 20 character long with a numeric, 1 lowercase and 1 uppercase letters"});
    }

    User.findOne({ _id: req.user })
    .then((user)=>{
        if(user.google_auth){
            return res.status(403).json({ error: "You can't change account's password because you logged in through google"});
        }

        bcrypt.compare(currentPassword, user.personal_info.password, (err, result) => {
            if(err){
                return res.status(500).json({ error: "Some error occured while changing the password, please try again later" });
            }
            if(!result){
                return res.status(403).json({error: "Incorrect current password"});
            }

            bcrypt.hash(newPassword, 10, (err, hashed_password)=>{
                User.findOneAndUpdate({ _id: req.user }, { "personal_info.password": hashed_password })
                .then((u)=>{
                    return res.status(200).json({ status:"Password changes succesfully" })
                })
                .catch(err=>{
                    return res.status(500).json({ error: "Some error occured while saving new password, please try again later" })
                })
            })
        })
    })
    .catch(err => {
        console.log(err);
        return res.status(500).json({ error: "User not found" });
    })
})

server.post('/latest-blogs', (req, res) => {
    let { page } = req.body;
    let maxLimit = 5;

    Blog.find({ draft: false })
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({ "publishedAt": -1 })
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page-1)*maxLimit)
    .limit(maxLimit)
    .then(blogs => {
        return res.status(200).json({ blogs });
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })
})

server.post('/all-latest-blogs-count', (req, res) => {
    Blog.countDocuments({ draft: false })
    .then(count => {
        return res.status(200).json({ totalDocs: count });
    })
    .catch(err => {
        console.log(err.message);
        return res.status(500).json({ error: err.message })
    })
})

server.get('/tranding-blogs', (req, res) => {

    Blog.find({ draft: false })
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({ "activity.total_read": -1, "activity.total_likes": -1, "publishedAt": -1 })
    .select("blog_id title publishedAt -_id")
    .limit(5)
    .then(blogs => {
        return res.status(200).json({ blogs });
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })
})

server.post("/search-blogs", (req, res) => {
    let { tag, query, author, page, limit, eliminate_blog } = req.body;
    let findQuery;

    if(tag){
        findQuery = { tags: tag, draft: false, blog_id: { $ne: eliminate_blog } };
    }else if(query){
        findQuery = { draft: false, title: new RegExp(query, 'i') };
    }else if(author){
        findQuery = { author, draft: false}
    }
    let maxLimit = limit ? limit : 2;
    

    Blog.find(findQuery)
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({ "publishedAt": -1 })
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page-1)*maxLimit)
    .limit(maxLimit)
    .then(blogs => {
        return res.status(200).json({ blogs });
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })
})

server.post('/search-blogs-count', (req, res) => {
    let { tag, author, query } = req.body;

    let findQuery;

    if(tag){
        findQuery = { tags: tag, draft: false };
    }else if(query){
        findQuery = { draft: false, title: new RegExp(query, 'i') };
    }else if(author){
        findQuery = { author, draft: false}
    }

    Blog.countDocuments(findQuery)
    .then(count => {
        return res.status(200).json({ totalDocs: count });
    })
    .catch(err => {
        console.log(err.message);
        return res.status(500).json({ error: err.message })
    })
    
})

server.post('/search-users', (req, res) => {
    let { query } = req.body;

    User.find({ "personal_info.username": new RegExp(query, 'i') })
    .limit(50)
    .select("personal_info.fullname personal_info.username personal_info.profile_img -_id")
    .then(users => {
        return res.status(200).json({ users });
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })
})

server.post('/get-profile', (req, res) => {

    let { username } = req.body;

    User.findOne({ "personal_info.username": username })
    .select("-personal_info.password -google_auth, -updatedAt -blogs")
    .then(user => {
        return res.status(200).json(user)
    })
    .catch(err => {
        console.log(err);
        return res.status(500).json({ error: err.message });
    })
})

server.post("/update-profile-img", verifyJWT, (req, res)=>{

    let { url } = req.body;

    User.findOneAndUpdate({ _id: req.user }, { "personal_info.profile_img": url })
    .then(() => {
        return res.status(200).json({ profile_img: url });
    })
    .catch(err => {
        return res.status(500).json({ error : error.message });
    })
})

server.post('/create-blog', verifyJWT, (req, res) => {
    let authorId = req.user;

    let { title, des, banner, tags, content, draft, id } = req.body;

    if(!title.length){
        return res.status(403).json({ error: "You must provide a title" });
    }

    if(!draft){
        if(!des.length || des.length > 200){
            return res.status(403).json({ error: "You must provide valid description" })
        }
        if(!banner.length){
            return res.status(403).json({ error: "You must provide a blog banner to publish it" });
        }
    
        if(!content.blocks.length){
            return res.status(403).json({ error: "There must be some blog content to publish it" });
        }
    
        if(!tags.length || tags.length>10){
            return res.status(403).json({ error: "Provide tags in order to publish the blog, Maximum 10" })
        }
    }



    tags = tags.map(tag => tag.toLowerCase());

    let blog_id = id || title.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, "-").trim() + nanoid();

    if(id){
        Blog.findOneAndUpdate({ blog_id }, { title, des, banner, content, tags, draft: draft ? draft:false })
        .then(() => {
            return res.status(200).json({ id: blog_id });
        })
        .catch(err => {
            return res.status(500).json({ error: err.message })
        })
    }else{
        let blog = new Blog({
            title, des, banner, content, tags, author: authorId, blog_id, draft: Boolean(draft)
        })
    
        blog.save().then(blog => {
            let incrementVal = draft ? 0 : 1;
    
            User.findOneAndUpdate({ _id: authorId }, { $inc: { "account_info.total_posts": incrementVal }, $push: { "blogs": blog._id } })
            .then(user => {
                return res.status(200).json({ id: blog.blog_id });
            }) 
            .catch(err => {
                return res.status(500).json({ error: "Failed to update total post number" });
            })
        })
        .catch(err => {
            return res.status(500).json({ error: err.message });
        })
    }
})

server.post("/get-blog", (req, res) => {
    let { blog_id, draft, mode } = req.body;
    let incrementVal = mode!='edit'?1:0;
    Blog.findOneAndUpdate({ blog_id }, { $inc: { "activity.total_reads": incrementVal } })
    .populate("author", "personal_info.fullname personal_info.username personal_info.profile_img")
    .select("title des content banner activity publishedAt blog_id tags")
    .then(blog => {
        User.findOneAndUpdate({ "personal_info.username": blog.author.personal_info.username }, {
            $inc: { "personal_info.total_reads": incrementVal }
        })
        .catch(err => {
            return res.status(500).json({error: err.message})
        })

        if(blog.draft && !draft){
            return res.status(500).json({ error: 'you can not access draft blogs' })
        }

        return res.status(200).json({ blog });
    })
    .catch(err => {
        return res.status(500).json({error: err.message})
    })
})

server.post("/liked-blog", verifyJWT, (req, res) => {
    let user_id = req.user;

    let{ _id, isLikedByUser } = req.body;

    let incrementVal = !isLikedByUser?1:-1;

    Blog.findOneAndUpdate({ _id }, { $inc: { "activity.total_likes": incrementVal } })
    .then(blog => {
        if(!isLikedByUser){
            let like = new Notification({
                type: "like",
                blog: _id,
                notification_for: blog.author,
                user: user_id
            })

            like.save().then(notification => {
                return res.status(200).json({ liked_by_user: true });
            })
        }else{
            Notification.findOneAndDelete({ user: user_id, blog: _id, type: "like" })
            .then(data => {
                return res.status(200).json({ liked_by_user: false });
            })
            .catch(err => {
                return res.status(500).json({error: err.message});
            })
        }
    })
})

server.post("/isliked-by-user", verifyJWT, (req, res) => {
    let user_id = req.user;
    let{ _id } = req.body;

    Notification.exists({ user: user_id, type: "like", blog: _id })
    .then(result => {
        return res.status(200).json({ result });
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })
})

server.post("/add-comment", verifyJWT, (req, res) => {
    let user_id = req.user;
    let { _id, comment, blog_author } = req.body;

    if(!comment.length){
        return res.status(403).json({ error: "write something to leave a comment" });
    }

    let commentObj = {
        blog_id: _id, blog_author, comment, commented_by: user_id
    }


    new Comment(commentObj).save().then( async commentFile => {
        let { comment, commentedAt, children } = commentFile;

        Blog.findOneAndUpdate({ _id }, { $push: { "comments": commentFile._id }, $inc: { "activity.total_comments": 1, "activity.total_parent_comments": 1 } })
        .then(blog => { console.log('New comment created') });

        let notificationObj = {
            type: "comment",
            blog: _id,
            notification_for: blog_author,
            user: user_id,
            comment: commentFile._id
        }


        new Notification(notificationObj).save().then(notification => console.log('New notification created'));

        return res.status(200).json({
            comment, commentedAt, _id: commentFile._id, user_id, children
        })
    })
})

server.post("/get-blog-comments", (req, res) => {
    let { blog_id, skip } = req.body;

    let maxLimit = 5;

    Comment.find({ blog_id, isReply: false })
    .populate("commented_by", "personal_info.username personal_info.fullname personal_info.profile_img")
    .skip(skip)
    .limit(maxLimit)
    .sort({
        'commentedAt': -1
    })
    .then(comment => {
        return res.status(200).json(comment);
    })
    .catch(err => {
        console.log(err.message);
        res.status(500).json({ error: err.message });
    })

})

server.listen(PORT, () => {
    console.log('listening on port => ' + PORT);
})