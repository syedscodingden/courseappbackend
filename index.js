const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = express();
const cors = require("cors");
const bcrypt = require("bcrypt");
const PORT = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());
app.use(express.json());

// let ADMINS = [];
// let USERS = [];
// let COURSES = [];

const adminSecret = "@$^^!n$ecret846%#^@";
const userSecret = "u$er$ecret072%#*";

const authenticateJwtAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, adminSecret, (err, admin) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.user = admin;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

const authenticateJwtUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, userSecret, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

//Defining Schemas
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  mobile: String,
  username: String,
  password: String,
  country: String,
  phoneCode: String,
  purchasedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
});

userSchema.pre("save", async function (next) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.password, salt);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  imageLink: String,
  published: Boolean,
});

//Mongoose models
const User = mongoose.model("User", userSchema);
const Admin = mongoose.model("Admin", adminSchema);
const Course = mongoose.model("Course", courseSchema);

// Connect to MongoDB
// DONT MISUSE THIS THANKYOU!!
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "courses",
});

app.get("/admin/me", authenticateJwtAdmin, (req, res) => {
  res.json({ username: req.user.username });
});

// Admin routes
app.post("/admin/signup", async (req, res) => {
  // logic to sign up admin
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (admin) {
    res.status(403).json({ msg: "admin already exists" });
  } else {
    const obj = { username: username, password: password };
    const newAdmin = new Admin(obj);
    await newAdmin.save();
    const token = jwt.sign({ username, role: "admin" }, adminSecret, {
      expiresIn: "1h",
    });
    res.json({ message: "Admin created successfully", token });
  }
});

app.post("/admin/login", async (req, res) => {
  // logic to log in admin
  const { username } = req.headers;
  const admin = await Admin.findOne({ username });
  if (admin) {
    const token = jwt.sign({ username, role: "admin" }, adminSecret, {
      expiresIn: "1h",
    });
    res.json({ message: "Logged in successfully", token });
  } else {
    res.status(403).json({ message: "Admin authentication failed" });
  }
});

app.post("/admin/courses", authenticateJwtAdmin, async (req, res) => {
  // logic to create a course
  const course = new Course(req.body);
  await course.save();
  res.json({ message: "Course created successfully", courseId: course.id });
});

app.put("/admin/courses/:courseId", async (req, res) => {
  // logic to edit a course
  const course = await Course.findByIdAndUpdate(req.params.courseId, req.body, {
    new: true,
  });
  if (course) {
    res.json({ message: "Course updated successfully" });
  } else {
    res.status(404).json({ message: "Course not found" });
  }
});

app.get("/admin/courses", authenticateJwtAdmin, async (req, res) => {
  // logic to get all courses
  const courses = await Course.find({});
  res.json({ courses, username: req.user.username });
});

// User routes

app.get("/users/me", authenticateJwtUser, async (req, res) => {
  const { username } = req.user;
  const user = await User.findOne({ username });
  if (user) {
    res.json({
      username: username,
      firstName: user.firstName,
      mobile: user.mobile,
    });
  } else {
    res.status(403).json({ message: "User authentication failed" });
  }
});

app.post("/users/signup", async (req, res) => {
  // logic to sign up user
  const {
    firstName,
    lastName,
    username,
    password,
    mobile,
    country,
    phoneCode,
  } = req.body;
  const user = await User.findOne({ username });
  if (user) {
    res.status(403).json({ msg: "user already exists" });
  } else {
    const obj = {
      firstName,
      lastName,
      username,
      password,
      mobile,
      country,
      phoneCode,
    };
    const newUser = new User(obj);
    await newUser.save();
    const token = jwt.sign({ username, role: "user" }, userSecret, {
      expiresIn: "1h",
    });
    res.json({
      message: "User created successfully",
      token,
      firstName: firstName,
      mobile: mobile,
    });
  }
});

app.post("/users/login", async (req, res) => {
  // logic to log in user
  const { username, password } = req.headers;
  const user = await User.findOne({ username });
  if (user) {
    bcrypt.compare(password, user.password, function (err, result) {
      if (result == true) {
        const token = jwt.sign({ username, role: "user" }, userSecret, {
          expiresIn: "1h",
        });
        res.json({
          message: "Logged in successfully",
          token,
          firstName: user.firstName,
          mobile: user.mobile,
        });
      } else {
        res.status(401).json({ message: "User authentication failed" });
      }
    });
  } else {
    res.status(403).json({ message: "User authentication failed" });
  }
});

app.get("/users/courses", authenticateJwtUser, async (req, res) => {
  // logic to list all courses
  const courses = await Course.find({});
  let filteredCourses = courses.filter((course) => course.published);
  res.status(200).json({
    courses: filteredCourses,
  });
});

app.post("/users/courses/:courseId", authenticateJwtUser, async (req, res) => {
  // logic to purchase a course
  const course = await Course.findById(req.params.courseId);
  if (course) {
    const user = await User.findOne({ username: req.user.username });
    if (user) {
      user.purchasedCourses.push(course);
      await user.save();
      res.json({ message: "Course purchased successfully" });
    } else {
      res.status(403).json({ message: "User not found" });
    }
  } else {
    res.status(404).json({ message: "Course not found" });
  }
});

app.get("/users/purchasedCourses", authenticateJwtUser, async (req, res) => {
  // logic to view purchased courses
  const user = await User.findOne({ username: req.user.username }).populate(
    "purchasedCourses"
  );
  if (user) {
    res.json({ purchasedCourses: user.purchasedCourses || [] });
  } else {
    res.status(403).json({ message: "User not found" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
