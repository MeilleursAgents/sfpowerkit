import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import * as puppeteer from "puppeteer";
import BrowserUtil from "../../../utils/browserutil";
import { SfdxError } from "@salesforce/core";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
//const messages = core.Messages.loadMessages("sfpowerkit", "package_info");

export default class disableentitlement extends SfdxCommand {
  public static description = "commandDescription";

  public static examples = [
    `$ sfdx sfpowerkit:browser:disableentitlement -u myOrg@example.com `
  ];

  protected static flagsConfig = {
    apiversion: flags.builtin({
      description: "apiversion"
    }),
    loglevel: flags.enum({
      description: "loglevel",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL"
      ]
    }),
    human: flags.boolean({
      required: false,
      description: "to set headless"
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;
  public async run(): Promise<AnyJson> {
    SFPowerkit.setLogLevel(this.flags.loglevel, this.flags.json);

    await this.org.refreshAuth();

    let entilementName = "portalentitlementprocess";

    let entitlement = await this.getentitlement(
      entilementName,
      this.org.getConnection()
    );

    if (!entitlement) {
      SFPowerkit.log(
        `entitlement ${entilementName} not found in the org`,
        LoggerLevel.ERROR
      );
      return true;
    }

    if (!entitlement.IsActive) {
      SFPowerkit.log(
        `entitlement ${entilementName} is already disabled in the org`,
        LoggerLevel.INFO
      );
    } else {
      let myBrowser = new BrowserUtil(this.org, !this.flags.human);

      await myBrowser.login();

      let encodedEntitlementId = encodeURIComponent(`/${entitlement.Id}`);
      let entitlementPage = await myBrowser.openPage(
        `${entitlement.Id}/e?&retURL=${encodedEntitlementId}`,
        { waitUntil: ["load", "domcontentloaded", "networkidle0"] }
      );

      await entitlementPage.waitFor(
        '.pbSubsection > table > tbody > tr > td > input[name="IsActive"]'
      );
      await entitlementPage.$eval(
        '.pbSubsection > table > tbody > tr > td > input[name="IsActive"]',
        (e, v) => {
          e.checked = v;
        },
        false
      );

      await entitlementPage.waitFor('#topButtonRow > input[name="save"]');
      await entitlementPage.click('#topButtonRow > input[name="save"]');
      await entitlementPage.waitForNavigation();
      SFPowerkit.log(
        `Successfully disabled the entitlement ${entilementName}`,
        LoggerLevel.INFO
      );

      if (!this.flags.human) {
        await myBrowser.logout();
      } else {
        SFPowerkit.log("you may need close the browser now", LoggerLevel.INFO);
      }
    }

    return true;
  }
  private async getentitlement(entilementName: string, conn: core.Connection) {
    let entitlement;
    let results = (await conn.query(
      `SELECT Id, Name, NameNorm, IsActive FROM SlaProcess WHERE Name = '${entilementName}'`
    )) as any;
    if (results.records && results.records.length > 0) {
      entitlement = results.records[0];
    }
    return entitlement;
  }
}
