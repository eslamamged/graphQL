require("./mongoconnect");
const { buildSchema } = require("graphql");
const { graphqlHTTP } = require("express-graphql");
const jwt = require("jsonwebtoken");
const jwtSecret = "husshh";
const express = require("express");
const User = require("./models/User");
const Post = require("./models/Post");
const Comment = require("./models/Comments");

/*
1 - Fork the repo
2 - clone your repo after forking
3 - make the changes
 Edit POST   (the post owner)
 Delete POST  (the post owner)
 Post comment to post
[{
  userId,
  content
}]
 Query to comments of specific post
 Edit getAllPosts query to get comment
 4 - git add .
 5 - git commit -m "Lab"
 6 - git push origin main
*/

const schema = buildSchema(`
  "The data the user needs to enter to register"
  input UserRegistrationInput {
    username: String!
    password: String!
    firstName: String!
    lastName: String!
    age: Int
  }
  type LoginPayload {
    token: String
    error: String
  }
  type User{
    firstName: String!
    lastName: String!
    age: Int
  }
  type Post{
    content: String!
    user: User!
    comments:[Comment]
    error:String
  }
  type Comment{
    error:String
    content:String
  }
  type Query{
    hello: String
    getMyPosts(token: String): [Post!]!
    getAllPosts: [Post!]!
    getPostComments(postId:String):[Comment!]!
  }
  type Mutation{
    createUser(userData: UserRegistrationInput): User
    loginUser(username: String, password: String): LoginPayload
    postCreate(token:String, content:String): String
    postUpdate(token:String,content:String,postId:String): Post
    postDelete(token:String,postId:String): String
    createComment(token:String,postId:String,content:String):String
  }
`);

const userMutations = {
  createUser: async ({
    userData: { username, password, firstName, lastName, age },
  }) => {
    const user = new User({
      username,
      password,
      firstName,
      lastName,
      age,
    });
    await user.save();
    return {
      firstName,
      lastName,
      age,
    };
  },
  loginUser: async ({ username, password }) => {
    const user = await User.findOne({ username });
    if (!user) return { error: "Login failed" };
    if (user.password !== password) return { error: "Login failed" };
    const token = jwt.sign({ userId: user.id }, jwtSecret);
    return { token };
  },
};

const auth = async (token) => {
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = User.findById(payload.userId);
    return user;
  } catch (error) {
    return null;
  }
};

const postsMutation = {
  postCreate: async ({ content, token }) => {
    const user = await auth(token);
    if (!user) return "Authentication error";
    const userId = user.id;
    const post = new Post({ userId, content });
    await post.save();
    return content;
  },
  postUpdate: async ({ content, token, postId }) => {
    const user = await auth(token);
    if (!user) return "Authentication error";
    const userId = user.id;
    try {
      const post = await Post.findOneAndUpdate({ _id: postId }, { content });
      if (!post) return "Post not found in database";
    } catch (error) {
      return null;
    }
    const updatedPost = await Post.findOne({ _id: postId }).populate("userId");
    return { ...updatedPost.toJSON(), user: updatedPost.userId };
  },
  postDelete: async ({ token, postId }) => {
    const user = await auth(token);
    if (!user) return "Authentication error";
    const userId = user.id;
    try {
      await Post.deleteOne({ _id: postId });
    } catch (error) {
      return null;
    }
    return "Post Deleted Successfully";
  },
  createComment: async ({ token, postId, content }) => {
    const user = await auth(token);
    if (!user) return "Authentication error";
    const comment = new Comment({ postId, content });
    try {
      await comment.save();
    } catch (error) {
      return null;
    }
    const post = await Post.findById({ _id: postId });
    post.comments.push(comment);
    await post.save();
    return "Comment Created Successfully";
  },
};

const postsQuery = {
  getMyPosts: async ({ token }) => {
    const user = await auth(token);
    if (!user) return "Authentication error";
    const userId = user.id;
    const posts = await Post.find({ userId });
    return posts.map((p) => ({ ...p.toJSON(), user }));
  },

  getAllPosts: async () => {
    const posts = await Post.find({}).populate("userId");
    return posts.map((p) => ({ ...p.toJSON(), user: p.userId }));
  },
  getPostComments: async ({ postId }) => {
    let comments;
    try {
      comments = await Comment.find({ postId: postId });
    } catch (error) {
      return null;
    }
    return comments;
  },
};

const rootValue = {
  ...userMutations,
  ...postsMutation,
  ...postsQuery,
  hello: () => "Hello world",
};

const app = express();

app.use("/graph", graphqlHTTP({ schema, rootValue, graphiql: true }));

app.listen(3000, () => {
  console.log("Server is runing");
});
