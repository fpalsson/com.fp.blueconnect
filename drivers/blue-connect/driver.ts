import { Driver } from 'homey';
// @ts-ignore
import { BlueriiotAPI} from 'blueriiot-api-client';

class BlueConnectDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('BlueConnectDriver has been initialized');
  }

  async onPair(session:any) {
    let username = "";
    let password = "";
    var api:any;

    session.setHandler("login", async (data:any) => {
      username = data.username;
      password = data.password;
      let credentialsAreValid = false;
      api = new BlueriiotAPI(username, password);
      try {
        await api.init();
      
        credentialsAreValid = api.isAuthenticated();
        console.log('Authenticated: ' + credentialsAreValid);
        // return true to continue adding the device if the login succeeded
        // return false to indicate to the user the login attempt failed
        // thrown errors will also be shown to the user
        return credentialsAreValid;
          
      } catch (error) {
          console.log("We have issues signing in: " + error);
          return false;
      
      }

      
    });

    session.setHandler("list_devices", async () => {
        let poolsStringData = await api.getSwimmingPools();
        //console.log(poolsStringData); 

        let poolsData = JSON.parse(poolsStringData);
        //data.swimming_pool.name
        //data.swimming_pool.swimming_pool_id

        let devices = new Array();
        poolsData.data.forEach((pool: { swimming_pool: { name: any; swimming_pool_id: any; }; }) => {
            devices.push({
                name: pool.swimming_pool.name,
                data: {
                    id: pool.swimming_pool.swimming_pool_id,
                },
                settings: {
                    // Store username & password in settings
                    // so the user can change them later
                    username,
                    password,
                },
            })
            
        });

        return devices;
    });
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return [
      // Example device data, note that `store` is optional
      // {
      //   name: 'My Device',
      //   data: {
      //     id: 'my-device',
      //   },
      //   store: {
      //     address: '127.0.0.1',
      //   },
      // },
    ];
  }
}

module.exports = BlueConnectDriver;