const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const databasePath = path.join(__dirname, "covid19IndiaPortal.db");
let database = null;
const initializeAndDbAndServer = async () => {
  try {
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(4000, () => {
      console.log(`server is running on http://localhost:4000`);
    });
  } catch (error) {
    console.log(`Database error is ${error}`);
    process.exit(1);
  }
};
initializeAndDbAndServer();

//API-1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "vamsi_secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//AUTHENTICATION WITH TOKEN
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers.authorization;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "vamsi_secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

// get the list of all the states
// API 1

const ConvertAPI1 = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

//API 2
//Returns a list of all states in the state table
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = "SELECT * FROM state; ";
  const statesArray = await database.all(getStatesQuery);
  response.send(statesArray.map((eachState) => ConvertAPI1(eachState)));
});

//API 3
//Returns a state based on the state ID
const convertCovid19API = (objectItem) => {
  return {
    stateId: objectItem.state_id,
    stateName: objectItem.state_name,
    population: objectItem.population,
  };
};

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const getStateQueryResponse = await database.get(getStateQuery);
  response.send(convertCovid19API(getStateQueryResponse));
});

//API 4
//Create a district in the district table
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictsQuery = `INSERT INTO district(district_name,state_id,cases, cured, active, deaths)
  VALUES ('${districtName}', ${stateId}, '${cases}', '${cured}', '${active}', '${deaths}');`;
  const createDistrictResponse = await database.run(addDistrictsQuery);
  response.send(`District Successfully Added`);
});

//API 5
//Returns a district based on the district ID
const convertCovid19API2 = (objectItem) => {
  return {
    districtId: objectItem.district_id,
    districtName: objectItem.district_name,
    stateId: objectItem.state_id,
    cases: objectItem.cases,
    cured: objectItem.cured,
    active: objectItem.active,
    deaths: objectItem.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const getDistrictQueryResponse = await database.get(getDistrictQuery);
    response.send(convertCovid19API2(getDistrictQueryResponse));
  }
);

//API 6
//Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await database.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

//API 7
//Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district SET district_name = '${districtName}', 
    state_id = ${stateId} , cases = '${cases}', cured = '${cured}',active = '${active}',
    deaths = '${deaths}'
     WHERE 
    district_id = ${districtId};`;
    await database.run(updateDistrictQuery);
    response.send(`District Details Updated`);
  }
);

//API 8
//Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `SELECT SUM(cases) AS totalCases, 
    SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS 
    totalDeaths 
    FROM
    district
    WHERE
    state_id = ${stateId};`;
    const getStateByIDStatsQueryResponse = await database.get(
      getStateByIDStatsQuery
    );
    response.send(getStateByIDStatsQueryResponse);
  }
);

module.exports = app;
