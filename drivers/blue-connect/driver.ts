import { Driver, FlowCardAction, FlowCardTriggerDevice } from 'homey';
// @ts-ignore
import { BlueriiotAPI} from 'blueriiot-api-client';

class BlueConnectDriver extends Driver {

  private actionRefreshMeasurement!: FlowCardAction;

  //private triggerPhChanged!: FlowCardTriggerDevice;  //Not needed as the SDK triggers the flow automatically as the name is xxx_changed
  private triggerPhGoesAbove!: FlowCardTriggerDevice;
  private triggerPhGoesBelow!: FlowCardTriggerDevice;

  //private triggerOrpChanged!: FlowCardTriggerDevice;  //Not needed as the SDK triggers the flow automatically as the name is xxx_changed
  private triggerOrpGoesAbove!: FlowCardTriggerDevice;
  private triggerOrpGoesBelow!: FlowCardTriggerDevice;

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('BlueConnectDriver initializing...');

    this.setupRunListeners();

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

  setupRunListeners(){
    this.actionRefreshMeasurement = this.homey.flow.getActionCard('trigger_refresh_measurement')
    this.actionRefreshMeasurement.registerRunListener(async (args:any, state:any) => {
      console.log('actionRefreshMeasurement run');
      //probalby should lock to make sure this is not run in parallell with timers
      args.device.refreshMeasurements();
      console.log('actionRefreshMeasurement done.');
    })
    
    this.triggerPhGoesAbove = this.homey.flow.getDeviceTriggerCard('measure_ph_goes_above');
    this.triggerPhGoesAbove.registerRunListener(async (args:any, state:any) => {
      console.log('triggerPhGoesAbove run');
      let ph:number = args.ph;
      let res = (state.prevVal <= ph && state.newVal > ph);
      console.log('triggerPhGoesAbove ph: ' + ph + ', prev: ' + state.prevVal + ', new: ' + state.newVal + ', run: ' + res);
      return res;
    });

    this.triggerPhGoesBelow = this.homey.flow.getDeviceTriggerCard('measure_orp_goes_below');
    this.triggerPhGoesBelow.registerRunListener(async (args:any, state:any) => {
      console.log('triggerPhGoesBelow run');
      let ph:number = args.ph;
      let res = (state.prevVal >= ph && state.newVal < ph);
      console.log('triggerPhGoesBelow ph: ' + ph + ', prev: ' + state.prevVal + ', new: ' + state.newVal + ', run: ' + res);
      return res;
    });

    this.triggerOrpGoesAbove = this.homey.flow.getDeviceTriggerCard('measure_orp_goes_above');
    this.triggerOrpGoesAbove.registerRunListener(async (args:any, state:any) => {
      console.log('triggerOrpGoesAbove run');
      let orp:number = args.orp;
      let res = (state.prevVal <= orp && state.newVal > orp);
      console.log('triggerOrpGoesAbove orp: ' + orp + ', prev: ' + state.prevVal + ', new: ' + state.newVal + ', run: ' + res);
      return res;
    })
    this.triggerOrpGoesBelow = this.homey.flow.getDeviceTriggerCard('measure_orp_goes_below');
    this.triggerOrpGoesBelow.registerRunListener(async (args:any, state:any) => {
      console.log('triggerOrpGoesBelow run');
      let orp:number = args.orp;
      let res = (state.prevVal >= orp && state.newVal < orp);
      console.log('triggerOrpGoesBelow orp: ' + orp + ', prev: ' + state.prevVal + ', new: ' + state.newVal + ', run: ' + res);
      return res;
    })




  }

}

module.exports = BlueConnectDriver;