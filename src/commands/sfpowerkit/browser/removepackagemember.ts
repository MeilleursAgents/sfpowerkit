import { core, flags, SfdxCommand } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { SFPowerkit, LoggerLevel } from "../../../sfpowerkit";
import * as puppeteer from "puppeteer";
import BrowserUtil from "./../../../utils/browserutil";
import { SfdxError } from "@salesforce/core";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
//const messages = core.Messages.loadMessages("sfpowerkit", "package_info");

export default class Removepackagemember extends SfdxCommand {
  public static description = "commandDescription";

  public static examples = [
    `$ sfdx sfpowerkit:browser:removepackagemember -u myOrg@example.com `
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

    let packageName = "core";

    let packageid = await this.getPackageId(
      packageName,
      this.org.getConnection()
    );

    if (!packageid)
      throw new SfdxError(`package ${packageName} not found in the org`);

    let myBrowser = new BrowserUtil(this.org, !this.flags.human);

    await myBrowser.login();

    let packageMemberPage = await myBrowser.openPage(
      `${packageid}?pkgComp=show`,
      { waitUntil: ["load", "domcontentloaded", "networkidle0"] }
    );
    packageMemberPage.on("dialog", async dialog => {
      await dialog.accept();
    });

    await packageMemberPage.waitForSelector(
      ".list > tbody > .first > .actionColumn > .actionLink"
    );
    await packageMemberPage.click(
      ".list > tbody > .first > .actionColumn > .actionLink"
    );
    await packageMemberPage.waitForNavigation();

    if (!this.flags.human) {
      await myBrowser.logout();
    } else {
      SFPowerkit.log("you may need close the browser now", LoggerLevel.INFO);
    }

    return true;
  }
  private async getPackageId(packagename: string, conn: core.Connection) {
    let packageid;
    let results = (await conn.tooling.query(
      "SELECT Id, SubscriberPackage.Name FROM InstalledSubscriberPackage"
    )) as any;
    if (results.records && results.records.length > 0) {
      for (let record of results.records) {
        if (record.SubscriberPackage.Name === packagename) {
          packageid = record.Id;
          break;
        }
      }
    }
    return packageid;
  }
}
